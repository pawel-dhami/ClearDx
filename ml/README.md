# Trained model

ClearDx runs on a model trained from public data. 

## Data

**Disease and symptoms dataset 2023** — Mendeley Data, version 1,
DOI [10.17632/2cxccsxydc.1](https://data.mendeley.com/datasets/2cxccsxydc/1), licence CC BY 4.0.
246,945 cases · 773 diseases · 377 binary symptom columns. The publisher states the
cases are **synthetic** (generated to preserve symptom severity and disease occurrence).

The data is not stored in this repository; `download.py` fetches it and checks its SHA-256.

## Train

```bash
python -m venv ml/.venv            # Python 3.11
ml/.venv/Scripts/python -m pip install -r ml/requirements.txt   # macOS/Linux: ml/.venv/bin/python
ml/.venv/Scripts/python ml/download.py
ml/.venv/Scripts/python ml/train.py
```

`train.py` compares Naive Bayes (Bernoulli, multinomial), a decision tree,
k-nearest neighbours, a linear SVM, multinomial logistic regression and a small
neural network (MLP) on the same duplicate-aware split (no identical case in both
training and test data), within a 30-minute budget.

## Outputs

| File | What |
| --- | --- |
| `ml/results/metrics.json` | Scores and timings for every algorithm |
| `lib/predict/model/disease-model.json` | Exported logistic-regression weights read by `lib/predict/ml.ts` |
| `lib/predict/model/training-report.json` | Same report, used by the `/model` page |

Logistic regression is exported because every symptom has one signed weight per
disease, which is exactly what the app's explanation graph shows.
