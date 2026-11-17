"""Trains and compares symptom → disease classifiers, then exports the explainable one.

    ml/.venv/Scripts/python ml/download.py
    ml/.venv/Scripts/python ml/train.py

Data: "Disease and symptoms dataset 2023" (Mendeley Data, DOI 10.17632/2cxccsxydc.1,
CC BY 4.0): 246,945 rows, 773 diseases, 377 binary symptom columns. Synthetic,
generated to follow real-world symptom severity and disease occurrence.

Evaluation is duplicate-aware: about 23% of rows are exact copies (the dataset encodes
how common a disease is by repeating rows), so the train/test split is made by unique
symptom pattern. No identical row appears in both training and test data.

Outputs
  ml/results/metrics.json              every model's scores and timings (also used by the app's /model page)
  lib/predict/model/disease-model.json the exported logistic-regression model used by the app (PREDICTOR=ml)
"""

from __future__ import annotations

import json
import os
import platform
import sys
import time
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import sklearn
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, top_k_accuracy_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.naive_bayes import BernoulliNB, MultinomialNB
from sklearn.neighbors import KNeighborsClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.svm import LinearSVC
from sklearn.tree import DecisionTreeClassifier

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "disease_symptoms_2023.csv"
RESULTS = ROOT / "results"
APP_MODEL = ROOT.parent / "lib" / "predict" / "model" / "disease-model.json"
APP_REPORT = ROOT.parent / "lib" / "predict" / "model" / "training-report.json"
SEED = 42
BUDGET_S = 30 * 60  # whole run, all models


# Windows consoles default to a legacy code page; print UTF-8 so log lines never crash the run.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
warnings.filterwarnings("ignore", message=".*sklearn.utils.parallel.delayed.*")


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def main() -> int:
    run_start = time.perf_counter()
    if not DATA.exists():
        print("Dataset missing. Run: ml/.venv/Scripts/python ml/download.py", file=sys.stderr)
        return 1

    # ---------- load ----------
    df = pd.read_csv(DATA)
    label_col = df.columns[0]
    y_text = df[label_col].astype(str).str.strip()
    X_df = df.drop(columns=[label_col]).astype(np.uint8)
    features = [c.strip() for c in X_df.columns]
    X = X_df.to_numpy(dtype=np.float32)
    classes = np.array(sorted(y_text.unique()))
    class_index = {c: i for i, c in enumerate(classes)}
    y = y_text.map(class_index).to_numpy()
    log(f"Loaded {X.shape[0]:,} rows · {X.shape[1]} symptoms · {len(classes)} diseases")

    # ---------- duplicate-aware split ----------
    # Group = the full row (symptoms + disease), so identical rows stay on one side.
    groups = pd.util.hash_pandas_object(df, index=False).to_numpy()
    n_unique = int(pd.Series(groups).nunique())
    splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=SEED)
    train_idx, test_idx = next(splitter.split(X, y, groups))
    X_train, X_test, y_train, y_test = X[train_idx], X[test_idx], y[train_idx], y[test_idx]
    labels = np.arange(len(classes))
    log(f"Split: {len(train_idx):,} train / {len(test_idx):,} test rows ({n_unique:,} unique rows; no pattern in both)")

    # ---------- candidates ----------
    candidates = [
        ("Bernoulli Naive Bayes", "naive_bayes_bernoulli", lambda: BernoulliNB(alpha=0.1)),
        ("Multinomial Naive Bayes", "naive_bayes_multinomial", lambda: MultinomialNB(alpha=0.1)),
        ("Decision tree", "decision_tree", lambda: DecisionTreeClassifier(min_samples_leaf=2, random_state=SEED)),
        ("k-nearest neighbours (k=25, cosine)", "knn", lambda: KNeighborsClassifier(n_neighbors=25, metric="cosine", weights="distance", n_jobs=-1)),
        ("Linear SVM (one-vs-rest)", "linear_svm", lambda: LinearSVC(C=0.5, max_iter=2000, random_state=SEED)),
        ("Logistic regression (multinomial)", "logistic_regression", lambda: LogisticRegression(C=2.0, max_iter=300, tol=1e-4)),
        (
            "Neural network (MLP, 1×512)",
            "mlp",
            lambda: MLPClassifier(hidden_layer_sizes=(512,), batch_size=512, learning_rate_init=1e-3, max_iter=30, early_stopping=True, n_iter_no_change=4, random_state=SEED),
        ),
    ]

    results = []
    fitted = {}
    for name, key, make in candidates:
        elapsed = time.perf_counter() - run_start
        if elapsed > BUDGET_S:
            log(f"Skipping {name}: 30-minute budget used ({elapsed / 60:.1f} min)")
            continue
        log(f"Training {name} …")
        model = make()
        t0 = time.perf_counter()
        model.fit(X_train, y_train)
        fit_s = time.perf_counter() - t0
        t0 = time.perf_counter()
        if hasattr(model, "predict_proba"):
            scores = model.predict_proba(X_test)
        else:
            scores = model.decision_function(X_test)
        pred_s = time.perf_counter() - t0
        # models only know the classes they saw; place their scores in the full class order
        full = np.full((len(X_test), len(classes)), -np.inf if not hasattr(model, "predict_proba") else 0.0, dtype=np.float64)
        full[:, model.classes_] = scores
        y_pred = full.argmax(1)
        finite = np.where(np.isfinite(full), full, -1e9)
        r = {
            "name": name,
            "key": key,
            "top1_accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
            "top3_accuracy": round(float(top_k_accuracy_score(y_test, finite, k=3, labels=labels)), 4),
            "top5_accuracy": round(float(top_k_accuracy_score(y_test, finite, k=5, labels=labels)), 4),
            "macro_f1": round(float(f1_score(y_test, y_pred, average="macro", labels=labels, zero_division=0)), 4),
            "fit_seconds": round(fit_s, 1),
            "predict_ms_per_case": round(pred_s / len(X_test) * 1000, 3),
        }
        results.append(r)
        fitted[key] = model
        log(f"  top-1 {r['top1_accuracy']:.3f} · top-3 {r['top3_accuracy']:.3f} · top-5 {r['top5_accuracy']:.3f} · macro-F1 {r['macro_f1']:.3f} · {fit_s:.0f}s")

    # ---------- export the explainable model ----------
    chosen_key = "logistic_regression"
    lr: LogisticRegression = fitted[chosen_key]
    coef = np.zeros((len(classes), len(features)), dtype=np.float64)
    intercept = np.full(len(classes), -30.0)  # classes never seen in training are effectively impossible
    coef[lr.classes_] = lr.coef_
    intercept[lr.classes_] = lr.intercept_
    # Sparse, rounded weights keep the file small; tiny weights barely move the scores.
    THRESH = 0.05
    weights = []
    kept = 0
    for c in range(len(classes)):
        row = {}
        for f in np.nonzero(np.abs(coef[c]) >= THRESH)[0]:
            row[int(f)] = round(float(coef[c, f]), 3)
        kept += len(row)
        weights.append(row)

    APP_MODEL.parent.mkdir(parents=True, exist_ok=True)
    model_json = {
        "format": "cleardx-logreg-v1",
        "algorithm": "Multinomial logistic regression (scikit-learn)",
        "dataset": "Disease and symptoms dataset 2023 (Mendeley Data, DOI 10.17632/2cxccsxydc.1, CC BY 4.0)",
        "features": features,
        "classes": classes.tolist(),
        "intercept": [round(float(v), 3) for v in intercept],
        # weights[class] = {featureIndex: weight}; logit = intercept + Σ weight·x
        "weights": weights,
        "pruned_below": THRESH,
    }
    APP_MODEL.write_text(json.dumps(model_json, separators=(",", ":")))
    log(f"Exported {chosen_key}: {kept:,} non-zero weights → {APP_MODEL.relative_to(ROOT.parent)} ({APP_MODEL.stat().st_size / 1e6:.1f} MB)")

    # Check the pruned, rounded export still scores like the original.
    W = np.zeros_like(coef)
    for c, row in enumerate(weights):
        for f, v in row.items():
            W[c, int(f)] = v
    logits = X_test @ W.T + np.array(model_json["intercept"])
    export_acc = float((logits.argmax(1) == y_test).mean())
    log(f"Exported model top-1 on the test set: {export_acc:.3f}")

    total_s = time.perf_counter() - run_start
    vc = pd.Series(y_text).value_counts()
    report = {
        "generated": time.strftime("%Y-%m-%d"),
        "dataset": {
            "name": "Disease and symptoms dataset 2023",
            "publisher": "Mendeley Data",
            "doi": "10.17632/2cxccsxydc.1",
            "url": "https://data.mendeley.com/datasets/2cxccsxydc/1",
            "licence": "CC BY 4.0",
            "synthetic": True,
            "rows": int(len(df)),
            "unique_rows": n_unique,
            "duplicate_rows": int(len(df) - n_unique),
            "diseases": int(len(classes)),
            "symptoms": int(len(features)),
            "mean_symptoms_per_row": round(float(X.sum(1).mean()), 2),
            "rows_per_disease": {"min": int(vc.min()), "median": float(vc.median()), "max": int(vc.max())},
        },
        "split": {
            "method": "GroupShuffleSplit by unique row (no identical symptom pattern in both sets)",
            "test_fraction": 0.2,
            "train_rows": int(len(train_idx)),
            "test_rows": int(len(test_idx)),
            "seed": SEED,
        },
        "models": results,
        "chosen": {
            "key": chosen_key,
            "reason": "Close to the best accuracy, and each symptom has one signed weight per disease, so every prediction can be explained exactly in the app's contribution graph.",
            "exported_top1_accuracy": round(export_acc, 4),
            "non_zero_weights": kept,
            "pruned_below": THRESH,
        },
        "total_training_minutes": round(total_s / 60, 1),
        "environment": {
            "python": platform.python_version(),
            "scikit_learn": sklearn.__version__,
            "numpy": np.__version__,
            "pandas": pd.__version__,
            "cpu_cores": os.cpu_count(),
        },
    }
    RESULTS.mkdir(parents=True, exist_ok=True)
    (RESULTS / "metrics.json").write_text(json.dumps(report, indent=2) + "\n")
    APP_REPORT.write_text(json.dumps(report, indent=2) + "\n")
    log(f"Done in {total_s / 60:.1f} min · report → ml/results/metrics.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
