"""Verifies the trained model the website actually uses (lib/predict/model/disease-model.json).

    ml/.venv/Scripts/python ml/download.py
    ml/.venv/Scripts/python ml/train.py
    ml/.venv/Scripts/python ml/verify.py

Four independent checks:
  1. Held-out test   the exported model on the same 20% test split train.py held back
                     (no identical case in both training and test data)
  2. Cross-validation 5-fold, grouped by unique case: the model is retrained five times on
                     different splits, so the score does not hinge on one lucky split
  3. Calibration     when the model says X% for its top pick, is it right about X% of the time?
  4. External test   a different public dataset the model never saw, in a different form:
                     "Symptom to Diagnosis" (gretelai, Hugging Face, Apache 2.0) — written
                     patient descriptions with a diagnosis. Symptoms are pulled out of the text
                     with simple phrase matching, so the test is conservative.

Outputs ml/results/verification.json and lib/predict/model/verification.json (read by the
app: the /model page, and each prediction's "how reliable is this confidence" note).
"""

from __future__ import annotations

import json
import re
import sys
import time
import urllib.request
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold, GroupShuffleSplit

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "disease_symptoms_2023.csv"
EXT_DIR = ROOT / "data" / "external"
MODEL = ROOT.parent / "lib" / "predict" / "model" / "disease-model.json"
OUT = [ROOT / "results" / "verification.json", ROOT.parent / "lib" / "predict" / "model" / "verification.json"]
SEED = 42
EXT_URL = "https://huggingface.co/datasets/gretelai/symptom_to_diagnosis/resolve/main/{}.jsonl"

# External labels → the training dataset's disease names (any listed name counts as correct).
# "jaundice" is a symptom rather than a diagnosis and has no single equivalent, so it is excluded.
LABEL_MAP = {
    "cervical spondylosis": ["spondylosis"],
    "impetigo": ["impetigo"],
    "arthritis": ["osteoarthritis", "rheumatoid arthritis", "arthritis of the hip", "reactive arthritis", "septic arthritis", "juvenile rheumatoid arthritis"],
    "dengue": ["dengue fever"],
    "malaria": ["malaria"],
    "allergy": ["allergy", "seasonal allergies (hay fever)", "allergy to animals", "food allergy", "conjunctivitis due to allergy"],
    "bronchial asthma": ["asthma"],
    "varicose veins": ["varicose veins"],
    "hypertension": ["malignant hypertension", "hypertensive heart disease"],
    "psoriasis": ["psoriasis"],
    "diabetes": ["diabetes"],
    "chicken pox": ["chickenpox"],
    "common cold": ["common cold"],
    "gastroesophageal reflux disease": ["gastroesophageal reflux disease (gerd)"],
    "urinary tract infection": ["urinary tract infection"],
    "drug reaction": ["drug reaction"],
    "fungal infection": ["fungal infection of the skin", "fungal infection of the hair"],
    "pneumonia": ["pneumonia"],
    "typhoid": ["typhoid fever"],
    "peptic ulcer disease": ["gastroduodenal ulcer"],
    "migraine": ["migraine"],
}

# Everyday wording → dataset symptom names (in addition to exact dataset names found in the text).
PHRASES = {
    r"runny nose|nose (?:is )?running": "coryza",
    r"stuffy nose|blocked nose|congested": "nasal congestion",
    r"sneez": "sneezing",
    r"\bcough": "cough",
    r"phlegm|mucus|sputum": "coughing up sputum",
    r"sore throat|throat (?:is )?(?:sore|scratchy|hurts)": "sore throat",
    r"short(?:ness)? of breath|can'?t breathe|hard to breathe|trouble breathing|breathless": "shortness of breath",
    r"wheez": "wheezing",
    r"chest (?:pain|hurts)|pain in my chest": "sharp chest pain",
    r"tight(?:ness)? in my chest|chest (?:feels )?tight": "chest tightness",
    r"\bfever|feverish|high temperature": "fever",
    r"\bchills?\b|shiver": "chills",
    r"sweat": "sweating",
    r"tired|exhausted|fatigue|no energy|weary": "fatigue",
    r"weak(?:ness)?\b": "weakness",
    r"headache|head (?:hurts|aches|is pounding)": "headache",
    r"dizz|light-?headed": "dizziness",
    r"nause|queasy|sick to my stomach": "nausea",
    r"vomit|throw(?:ing)? up|threw up": "vomiting",
    r"diarrh|loose stool|watery stool": "diarrhea",
    r"constipat": "constipation",
    r"stomach (?:pain|ache|hurts)|belly (?:pain|ache)|abdominal pain|pain in my (?:stomach|abdomen|belly)": "sharp abdominal pain",
    r"burning (?:sensation )?in my (?:stomach|chest)|heartburn": "heartburn",
    r"bloat": "stomach bloating",
    r"(?:lost|loss of|no) appetite|don'?t feel like eating": "decreased appetite",
    r"burn(?:s|ing)? when i (?:pee|urinate)|pain(?:ful)? (?:when )?urinat|hurts to pee": "painful urination",
    r"urinate (?:a lot|frequently|often)|frequent urination|pee (?:a lot|often|frequently)": "frequent urination",
    r"thirst": "thirst",
    r"blurr": "diminished vision",
    r"itchy eyes|eyes (?:are )?itch": "itchiness of eye",
    r"watery eyes|eyes (?:are )?water": "lacrimation",
    r"red eyes|eyes (?:are )?red": "eye redness",
    r"rash": "skin rash",
    r"itch": "itching of skin",
    r"blister|sores?\b": "skin lesion",
    r"dry (?:skin|patches)|flak|scal(?:y|es)": "skin dryness, peeling, scaliness, or roughness",
    r"joint(?:s)? (?:pain|hurt|ache)|pain in my joints|achy joints": "joint pain",
    r"stiff (?:joints?|knees?)|joints? (?:are|feel) stiff": "joint stiffness or tightness",
    r"swollen joints?|joints? (?:are )?swollen": "joint swelling",
    r"neck (?:pain|hurts)|pain in my neck": "neck pain",
    r"stiff neck|neck (?:is |feels )?stiff": "neck stiffness or tightness",
    r"back (?:pain|hurts)|pain in my back": "back pain",
    r"muscle (?:pain|ache)|body aches?|aching all over|achy": "muscle pain",
    r"leg(?:s)? (?:pain|hurt|ache)": "leg pain",
    r"swollen (?:legs?|ankles?|feet)": "leg swelling",
    r"weight loss|lost (?:a lot of )?weight": "recent weight loss",
    r"yellow(?:ish)? (?:skin|eyes)|skin (?:is |has turned )?yellow": "jaundice",
    r"numb|tingl|pins and needles": "paresthesia",
    r"palpitat|heart (?:is )?(?:racing|pounding)": "palpitations",
}


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def load_model():
    m = json.loads(MODEL.read_text())
    W = np.zeros((len(m["classes"]), len(m["features"])))
    for c, row in enumerate(m["weights"]):
        for f, v in row.items():
            W[c, int(f)] = v
    return m, W, np.array(m["intercept"])


def softmax(z: np.ndarray) -> np.ndarray:
    z = z - z.max(1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(1, keepdims=True)


def topk(probs: np.ndarray, correct: list[set[int]], k: int) -> float:
    order = np.argsort(-probs, axis=1)[:, :k]
    return float(np.mean([bool(set(row) & ok) for row, ok in zip(order, correct)]))


def calibration(probs: np.ndarray, y: np.ndarray, bins: int = 10):
    conf = probs.max(1)
    hit = probs.argmax(1) == y
    edges = np.linspace(0, 1, bins + 1)
    out, ece = [], 0.0
    for lo, hi in zip(edges[:-1], edges[1:]):
        sel = (conf >= lo) & (conf < hi if hi < 1 else conf <= hi)
        if not sel.any():
            continue
        acc, mean_conf = float(hit[sel].mean()), float(conf[sel].mean())
        ece += sel.mean() * abs(acc - mean_conf)
        out.append({"from": round(float(lo), 1), "to": round(float(hi), 1), "cases": int(sel.sum()), "mean_confidence": round(mean_conf, 3), "accuracy": round(acc, 3)})
    return out, round(float(ece), 4)


def main() -> int:
    t_start = time.perf_counter()
    m, W, b = load_model()
    feat_index = {f.lower(): i for i, f in enumerate(m["features"])}
    class_index = {c: i for i, c in enumerate(m["classes"])}

    # ---------- data & the same split as train.py ----------
    df = pd.read_csv(DATA)
    y_text = df[df.columns[0]].astype(str).str.strip()
    X = df.drop(columns=[df.columns[0]]).to_numpy(dtype=np.float32)
    y = y_text.map(class_index).to_numpy()
    groups = pd.util.hash_pandas_object(df, index=False).to_numpy()
    train_idx, test_idx = next(GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=SEED).split(X, y, groups))

    # ---------- 1. held-out test of the exported model ----------
    probs = softmax(X[test_idx] @ W.T + b)
    yt = y[test_idx]
    sets = [{int(v)} for v in yt]
    holdout = {
        "cases": int(len(test_idx)),
        "top1_accuracy": round(topk(probs, sets, 1), 4),
        "top3_accuracy": round(topk(probs, sets, 3), 4),
        "top5_accuracy": round(topk(probs, sets, 5), 4),
        # context: always guessing the most common disease
        "baseline_most_common_top1": round(float(np.mean(yt == np.bincount(y[train_idx]).argmax())), 4),
    }
    log(f"Held-out: top-1 {holdout['top1_accuracy']:.3f} · top-3 {holdout['top3_accuracy']:.3f} (most-common baseline {holdout['baseline_most_common_top1']:.3f})")

    # ---------- 3. calibration ----------
    bins, ece = calibration(probs, yt)
    log(f"Calibration: expected calibration error {ece:.3f}")

    # Per-disease recall (diseases with at least 50 test cases)
    pred = probs.argmax(1)
    per = []
    for c in np.unique(yt):
        sel = yt == c
        if sel.sum() >= 50:
            per.append({"disease": m["classes"][c], "cases": int(sel.sum()), "recall": round(float((pred[sel] == c).mean()), 3)})
    per.sort(key=lambda r: r["recall"])

    # ---------- 2. 5-fold grouped cross-validation (retrains the model each fold) ----------
    folds = []
    for i, (tr, te) in enumerate(GroupKFold(n_splits=5).split(X, y, groups)):
        t0 = time.perf_counter()
        lr = LogisticRegression(C=2.0, max_iter=300, tol=1e-4).fit(X[tr], y[tr])
        p = np.zeros((len(te), len(m["classes"])))
        p[:, lr.classes_] = lr.predict_proba(X[te])
        s = [{int(v)} for v in y[te]]
        folds.append({"fold": i + 1, "top1_accuracy": round(topk(p, s, 1), 4), "top3_accuracy": round(topk(p, s, 3), 4), "seconds": round(time.perf_counter() - t0)})
        log(f"Fold {i + 1}/5: top-1 {folds[-1]['top1_accuracy']:.3f} · top-3 {folds[-1]['top3_accuracy']:.3f}")
    t1 = [f["top1_accuracy"] for f in folds]
    t3 = [f["top3_accuracy"] for f in folds]
    cv = {"folds": folds, "top1_mean": round(float(np.mean(t1)), 4), "top1_std": round(float(np.std(t1)), 4), "top3_mean": round(float(np.mean(t3)), 4), "top3_std": round(float(np.std(t3)), 4)}

    # ---------- 4. external dataset ----------
    EXT_DIR.mkdir(parents=True, exist_ok=True)
    rows = []
    for split in ("train", "test"):
        path = EXT_DIR / f"s2d_{split}.jsonl"
        if not path.exists():
            req = urllib.request.Request(EXT_URL.format(split), headers={"User-Agent": "cleardx-training/1.0"})
            path.write_bytes(urllib.request.urlopen(req, timeout=60).read())
        rows += [json.loads(line) for line in path.read_text(encoding="utf8").splitlines() if line.strip()]
    patterns = [(re.compile(p), feat_index[f.lower()]) for p, f in PHRASES.items() if f.lower() in feat_index]
    # exact dataset symptom names, longest first (word-bounded)
    names = sorted(feat_index, key=len, reverse=True)
    name_patterns = [(re.compile(rf"\b{re.escape(n)}\b"), feat_index[n]) for n in names if len(n) > 3]

    ext_X, ext_sets, ext_labels, extracted = [], [], [], []
    skipped = 0
    for r in rows:
        label = r["output_text"].strip().lower()
        if label not in LABEL_MAP:
            skipped += 1
            continue
        text = r["input_text"].lower()
        x = np.zeros(len(m["features"]), dtype=np.float32)
        for pat, i in name_patterns + patterns:
            if pat.search(text):
                x[i] = 1
        ext_X.append(x)
        ext_sets.append({class_index[c] for c in LABEL_MAP[label] if c in class_index})
        ext_labels.append(label)
        extracted.append(int(x.sum()))
    ext_X = np.array(ext_X)
    p_ext = softmax(ext_X @ W.T + b)
    has = np.array(extracted) > 0
    per_label = []
    for label in LABEL_MAP:
        sel = np.array([lab == label for lab in ext_labels])
        if sel.any():
            per_label.append({"diagnosis": label, "cases": int(sel.sum()), "top3_accuracy": round(topk(p_ext[sel], [s for s, k in zip(ext_sets, sel) if k], 3), 3)})
    per_label.sort(key=lambda r: -r["top3_accuracy"])
    external = {
        "name": "Symptom to Diagnosis",
        "publisher": "Gretel.ai (Hugging Face)",
        "url": "https://huggingface.co/datasets/gretelai/symptom_to_diagnosis",
        "licence": "Apache 2.0",
        "note": "Written patient descriptions (rewritten with a language model by the publisher, no personal data), one diagnosis each.",
        "total_cases": len(rows),
        "cases_used": int(len(ext_labels)),
        "diagnoses_used": len(LABEL_MAP),
        "excluded": {"jaundice": skipped},
        "mean_symptoms_extracted": round(float(np.mean(extracted)), 2),
        "cases_with_no_symptom_found": int((~has).sum()),
        "top1_accuracy": round(topk(p_ext, ext_sets, 1), 4),
        "top3_accuracy": round(topk(p_ext, ext_sets, 3), 4),
        "top5_accuracy": round(topk(p_ext, ext_sets, 5), 4),
        "top10_accuracy": round(topk(p_ext, ext_sets, 10), 4),
        "chance_top5": round(5 / len(m["classes"]), 4),
        "per_diagnosis": per_label,
    }
    log(f"External ({external['cases_used']} cases): top-1 {external['top1_accuracy']:.3f} · top-3 {external['top3_accuracy']:.3f} · top-5 {external['top5_accuracy']:.3f}")

    report = {
        "generated": time.strftime("%Y-%m-%d"),
        "model_file": "lib/predict/model/disease-model.json",
        "holdout": holdout,
        "cross_validation": cv,
        "calibration": {"bins": bins, "expected_calibration_error": ece},
        "per_disease": {"lowest": per[:8], "highest": per[-8:][::-1], "diseases_scored": len(per)},
        "external": external,
        "minutes": round((time.perf_counter() - t_start) / 60, 1),
    }
    for path in OUT:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(report, indent=2) + "\n")
    log(f"Done in {report['minutes']} min → ml/results/verification.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
