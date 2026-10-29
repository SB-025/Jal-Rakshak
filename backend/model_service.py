"""Versioned demo/real models; demo bundles never score hardware readings."""
import csv
import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import StratifiedGroupKFold

BASE_FEATURES = ['voltage', 'waterflow', 'density', 'temperature', 'environment_temperature', 'humidity']
PART_FEATURES = BASE_FEATURES + ['vibration_rms', 'current', 'pressure']
PARTS = {
    'normal': 'No component pattern detected',
    'bearing': 'Bearing / alignment',
    'winding': 'Motor winding / electrical load',
    'impeller': 'Impeller / intake flow path',
    'cooling': 'Cooling system / airflow',
    'supply': 'Power supply / wiring',
}
TRAIN_LOCK = threading.Lock()


def model_directory():
    return Path(os.getenv('MODEL_DIR', str(Path(__file__).with_name('model_artifacts'))))


def model_path(source):
    return model_directory() / ('demo.joblib' if source == 'demo' else 'hardware.joblib')


def demo_training_rows():
    """Synthetic component scenarios; not measured failure signatures."""
    rng = np.random.default_rng(128)
    scenarios = {
        'normal': [230, 50, 998, 45, 30, 62, 1.3, 5, 3],
        'bearing': [230, 43, 998, 70, 30, 62, 7, 6.5, 2.7],
        'winding': [227, 44, 998, 85, 30, 62, 1.9, 11, 2.8],
        'impeller': [230, 16, 998, 61, 30, 62, 3, 7, 0.9],
        'cooling': [230, 49, 998, 83, 30, 62, 1.6, 5.3, 3],
        'supply': [184, 36, 998, 64, 30, 62, 2, 8, 2.1],
    }
    scales = np.array([4, 3, 1, 3.5, 2, 5, .35, .5, .18])
    rows = []
    for label, center in scenarios.items():
        for group in range(12):
            group_offset = rng.normal(0, scales * .45)
            for _ in range(20):
                vector = np.maximum(.01, np.array(center) + group_offset + rng.normal(0, scales))
                row = dict(zip(PART_FEATURES, (round(float(value), 4) for value in vector)))
                row.update(component_label=label, motor_group=f'sim-{label}-{group}', data_source='demo', inspection_confirmed=False)
                rows.append(row)
    return rows


def train_bundle(rows, source):
    if source not in {'demo', 'hardware'}:
        raise ValueError('Training source must be demo or hardware')
    if not 120 <= len(rows) <= 100000:
        raise ValueError('Provide 120–100000 labelled rows, including normal operation')
    for row in rows:
        if row.get('component_label') not in PARTS:
            raise ValueError('Unsupported component label')
        if row.get('data_source') != source:
            raise ValueError('Demo and hardware training records must not be mixed')
        if source == 'hardware' and str(row.get('inspection_confirmed', '')).lower() not in {'true', '1'}:
            raise ValueError('Hardware fault labels must be inspection-confirmed')
        if not row.get('motor_group'):
            raise ValueError('motor_group is required for independent motor-group validation')
        for feature in PART_FEATURES:
            try:
                value = float(row[feature])
            except (KeyError, TypeError, ValueError):
                raise ValueError(f'All model training rows require numeric {feature}')
            if not np.isfinite(value) or (feature not in {'temperature', 'environment_temperature'} and value < 0):
                raise ValueError('Training measurements must be finite and physically valid')
            if feature in {'temperature', 'environment_temperature'} and value < -273.15:
                raise ValueError('Temperature is below absolute zero')
            if feature == 'humidity' and value > 100:
                raise ValueError('Humidity must be between 0 and 100')
    labels = np.array([row['component_label'] for row in rows])
    groups = np.array([row['motor_group'] for row in rows])
    classes = sorted(set(labels))
    if 'normal' not in classes or len(classes) < 2:
        raise ValueError('Include normal operation and at least one fault class')
    for label in classes:
        if sum(labels == label) < 40 or len(set(groups[labels == label])) < 3:
            raise ValueError('Each class needs at least 40 samples from 3 independent motor groups')
    x = np.array([[float(row[key]) for key in PART_FEATURES] for row in rows])
    train_idx, test_idx = next(StratifiedGroupKFold(n_splits=3, shuffle=True, random_state=128).split(x, labels, groups))
    if set(labels[train_idx]) != set(classes) or set(labels[test_idx]) != set(classes):
        raise ValueError('Group split must cover all classes in training and holdout sets')
    classifier = RandomForestClassifier(n_estimators=150, min_samples_leaf=3, class_weight='balanced', random_state=128, n_jobs=1)
    classifier.fit(x[train_idx], labels[train_idx])
    predictions = classifier.predict(x[test_idx])
    normal_train = train_idx[labels[train_idx] == 'normal']
    anomaly = IsolationForest(n_estimators=150, contamination=.05, random_state=128, n_jobs=1)
    anomaly.fit(x[normal_train, :len(BASE_FEATURES)])
    normal_test = test_idx[labels[test_idx] == 'normal']
    metadata = {
        'version': datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'),
        'source': source, 'deployment_status': 'demo_only' if source == 'demo' else 'experimental_hardware',
        'classifier': 'RandomForestClassifier', 'anomaly_detector': 'IsolationForest',
        'trained_at': datetime.now(timezone.utc).isoformat(), 'training_rows': len(train_idx), 'holdout_rows': len(test_idx),
        'training_groups': len(set(groups[train_idx])), 'holdout_groups': len(set(groups[test_idx])),
        'validation': 'independent motor-group holdout; synthetic scenarios only' if source == 'demo' else 'independent motor-group holdout; not a field certification',
        'accuracy': round(float(accuracy_score(labels[test_idx], predictions)), 4),
        'macro_f1': round(float(f1_score(labels[test_idx], predictions, average='macro')), 4),
        'normal_holdout_false_positive_rate': round(float(np.mean(anomaly.predict(x[normal_test, :len(BASE_FEATURES)]) == -1)), 4),
        'classification_report': classification_report(labels[test_idx], predictions, output_dict=True, zero_division=0),
        'base_features': BASE_FEATURES, 'component_features': PART_FEATURES, 'classes': classes,
        'limitation': 'Synthetic test scores do not measure real motor fault accuracy.' if source == 'demo' else 'Experimental support only. Verify faults by inspection; model votes are uncalibrated.',
    }
    bundle = {'metadata': metadata, 'anomaly': anomaly, 'classifier': classifier}
    with TRAIN_LOCK:
        folder = model_directory()
        folder.mkdir(parents=True, exist_ok=True)
        path = model_path(source)
        temporary = path.with_suffix('.joblib.tmp')
        joblib.dump(bundle, temporary)
        os.replace(temporary, path)
        path.with_suffix('.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
    return metadata


def load_bundle(source):
    path = model_path(source)
    if not path.exists():
        return None
    # Only locally trained, server-controlled artifacts are loaded. No upload endpoint accepts pickles.
    try:
        with TRAIN_LOCK:
            bundle = joblib.load(path)
        if bundle['metadata']['source'] != source:
            return None
        return bundle
    except (OSError, ValueError, KeyError, EOFError):
        return None


def model_status():
    result = {}
    for source in ['demo', 'hardware']:
        bundle = load_bundle(source)
        result[source] = bundle['metadata'] if bundle else None
    return result


def assess_models(reading, source):
    if source not in {'demo', 'hardware'}:
        return {'status': 'unsupported_source', 'reason': 'Manual readings are not scored by a hardware or demo model.'}
    bundle = load_bundle(source)
    if not bundle:
        return {'status': 'not_trained', 'reason': f'No {source} model is trained. Demo models cannot score hardware.'}
    result = {'status': 'available', 'metadata': bundle['metadata'], 'component_prediction': None}
    if any(reading.get(feature) is None for feature in BASE_FEATURES):
        return {'status': 'insufficient_sensors', 'reason': 'Base anomaly features are missing'}
    x = np.array([[float(reading[key]) for key in BASE_FEATURES]])
    result['anomaly'] = {
        'is_anomaly': bool(bundle['anomaly'].predict(x)[0] == -1),
        'decision_score': round(float(bundle['anomaly'].decision_function(x)[0]), 5),
        'interpretation': 'Negative scores indicate a deviation from the learned normal baseline; this is not a fault probability.',
    }
    missing = [key for key in PART_FEATURES if reading.get(key) is None]
    if missing:
        result['component_unavailable_reason'] = 'Component classifier requires missing sensors: ' + ', '.join(missing)
        return result
    x = np.array([[float(reading[key]) for key in PART_FEATURES]])
    votes = bundle['classifier'].predict_proba(x)[0]
    order = np.argsort(votes)[::-1]
    top = int(order[0])
    label = str(bundle['classifier'].classes_[top])
    if votes[top] < .55 or (len(order) > 1 and votes[top] - votes[int(order[1])] < .15):
        result['component_unavailable_reason'] = 'Model support is ambiguous; no component is singled out.'
        return result
    # An uncalibrated vote can rank a hypothesis but never confirms a damaged part.
    result['component_prediction'] = {
        'component_id': label, 'label': PARTS[label], 'status': 'model_suggestion_not_confirmed',
        'vote_fraction': round(float(votes[top]), 4), 'vote_is_calibrated_probability': False,
        'ranking': [{'component_id': str(bundle['classifier'].classes_[i]), 'label': PARTS[str(bundle['classifier'].classes_[i])], 'vote_fraction': round(float(votes[i]), 4)} for i in order[:3]],
    }
    return result


if __name__ == '__main__':
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).with_name('.env'))
    import argparse
    parser = argparse.ArgumentParser(description='Train FlowRaksh models on demo scenarios or inspection-confirmed hardware CSV')
    parser.add_argument('--demo', action='store_true')
    parser.add_argument('--csv', type=Path)
    args = parser.parse_args()
    if args.demo:
        rows, source = demo_training_rows(), 'demo'
    elif args.csv:
        with args.csv.open(encoding='utf-8-sig', newline='') as stream:
            rows = list(csv.DictReader(stream))
        source = 'hardware'
    else:
        parser.error('Choose --demo or --csv path/to/confirmed-data.csv')
    print(json.dumps(train_bundle(rows, source), indent=2))
