import json
import os
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import httpx
import pytest

import diagnostics_service as service
import model_service
from test_api import api, auth, motor_body


@pytest.fixture(scope='module')
def bundle_dir(tmp_path_factory):
    folder = tmp_path_factory.mktemp('model_artifacts')
    with patch.dict(os.environ, {'MODEL_DIR': str(folder)}):
        model_service.train_bundle(model_service.demo_training_rows(), 'demo')
    return folder


@pytest.fixture(autouse=True)
def isolated_models(monkeypatch, bundle_dir):
    monkeypatch.setenv('MODEL_DIR', str(bundle_dir))
    monkeypatch.setattr(service, 'config', lambda name, default='': '' if name == 'OLLAMA_API_KEY' else default)


def rich_reading(n=23):
    return {'voltage': 230, 'waterflow': 44 - n * .04, 'density': 998.2, 'temperature': 53 + n * .75,
            'environment_temperature': 30, 'humidity': 62, 'vibration_rms': 4 + n * .13, 'current': 5.5 + n * .04, 'pressure': 2.7,
            'source': 'demo', '_id': 'test-reading', 'recorded_at': datetime.now(timezone.utc) - timedelta(minutes=(23 - n) * 5)}


def report_fixture():
    motor = {'_id': 'test-motor', 'motor_name': 'Private motor name', 'coordinates': {'latitude': 19, 'longitude': 72}, 'source': 'demo'}
    limits = {'temperature_warning': 65, 'temperature_critical': 80, 'flow_minimum': 20, 'voltage_minimum': 200, 'voltage_maximum': 250}
    return service.assess(motor, [rich_reading(n) for n in range(23, -1, -1)], limits)


def test_demo_training_and_no_hardware_crossover():
    metadata = model_service.model_status()['demo']
    assert metadata['source'] == 'demo' and metadata['deployment_status'] == 'demo_only'
    assert metadata['training_groups'] == 48 and metadata['holdout_groups'] == 24
    assert metadata['training_rows'] + metadata['holdout_rows'] == 1440
    prediction = model_service.assess_models(rich_reading(), 'demo')
    assert prediction['component_prediction']['component_id'] == 'bearing'
    assert not prediction['component_prediction']['vote_is_calibrated_probability']
    assert model_service.assess_models(rich_reading(), 'hardware')['status'] == 'not_trained'
    incomplete = rich_reading()
    incomplete['vibration_rms'] = None
    result = model_service.assess_models(incomplete, 'demo')
    assert result['component_prediction'] is None
    assert 'vibration_rms' in result['component_unavailable_reason']
    with pytest.raises(ValueError, match='must not be mixed'):
        model_service.train_bundle(model_service.demo_training_rows(), 'hardware')


def test_trend_projection_and_abstention():
    result = report_fixture()
    assert result['confirmed_damaged_part'] is None
    assert result['condition'] == 'warning'
    temperature = result['forecasts'][0]
    assert temperature['status'] == 'available'
    assert temperature['projected_value'] == pytest.approx(79.25, abs=.1)
    assert temperature['validation_mae'] < .01
    assert service.trend_forecast([rich_reading()], 'temperature', 60, {'temperature_warning': 65})['status'] == 'insufficient_history'
    duplicate = [rich_reading() for _ in range(12)]
    for row in duplicate:
        row['recorded_at'] = duplicate[0]['recorded_at']
    assert service.trend_forecast(duplicate, 'temperature', 60, {'temperature_warning': 65})['status'] == 'insufficient_history'
    assert service.explain_with_cloud(result)['status'] == 'not_configured'


def test_cloud_success_validates_and_minimizes_payload(monkeypatch):
    captured = {}
    monkeypatch.setattr(service, 'config', lambda name, default='': 'unit-test-key' if name == 'OLLAMA_API_KEY' else default)
    explanation = {'summary': 'Simulated vibration and temperature justify inspecting the bearing and cooling path; damage is not confirmed.',
                   'observations': [{'evidence_id': 'vibration_rms', 'explanation': 'The supplied demo vibration screening limit was exceeded.'}],
                   'component_assessments': [{'component_id': 'bearing', 'reasoning': 'A bearing or alignment issue is a hypothesis to inspect.'}],
                   'recommended_actions': ['Arrange a qualified vibration and alignment inspection.']}
    class Client:
        def __init__(self, **kwargs):
            pass
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def post(self, url, **kwargs):
            captured.update(url=url, **kwargs)
            return httpx.Response(200, json={'message': {'content': json.dumps(explanation)}})
    monkeypatch.setattr(service.httpx, 'Client', Client)
    result = service.explain_with_cloud(report_fixture())
    assert result['status'] == 'generated'
    assert captured['url'] == 'https://ollama.com/api/chat'
    assert 'format' not in captured['json']  # Current Ollama Cloud does not enforce JSON schema output.
    user_payload = json.loads(captured['json']['messages'][1]['content'])
    assert 'coordinates' not in user_payload and 'motor_name' not in user_payload
    assert 'unit-test-key' not in captured['json']['messages'][1]['content']
    explanation['observations'][0]['evidence_id'] = 'invented-pressure-event'
    assert service.explain_with_cloud(report_fixture())['status'] == 'invalid_response'


def test_cloud_timeout_keeps_local_results(monkeypatch):
    monkeypatch.setattr(service, 'config', lambda name, default='': 'unit-test-key' if name == 'OLLAMA_API_KEY' else default)
    class Client:
        def __init__(self, **kwargs):
            pass
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def post(self, *args, **kwargs):
            raise httpx.ReadTimeout('private upstream error')
    monkeypatch.setattr(service.httpx, 'Client', Client)
    report = report_fixture()
    cloud = service.explain_with_cloud(report)
    assert cloud['status'] == 'timeout'
    assert report['model_assessment']['component_prediction']['component_id'] == 'bearing'
    assert 'private upstream error' not in cloud['message']


def test_diagnosis_api_saves_report_and_history(api):
    headers = auth(api)
    assert api.get('/diagnostics/status').status_code == 401
    assert api.post('/models/train-demo', json={'demo_only': False}, headers=headers).status_code == 422
    motor = api.post('/motors', json={**motor_body(), 'source': 'demo'}, headers=headers).json()
    endpoint = '/motors/' + motor['id']
    assert api.post(endpoint + '/diagnose', json={'use_cloud': False}, headers=headers).status_code == 409
    origin = datetime.now(timezone.utc) - timedelta(hours=2)
    for n in range(24):
        reading = rich_reading(n)
        reading.pop('_id')
        reading.pop('recorded_at')
        reading.update(motor_id=motor['id'], measured_at=(origin + timedelta(minutes=n * 5)).isoformat())
        assert api.post('/readings', json=reading, headers=headers).status_code == 201
    response = api.post(endpoint + '/diagnose', json={'use_cloud': True, 'horizon_minutes': 60}, headers=headers)
    assert response.status_code == 201, response.text
    report = response.json()
    assert report['cloud']['status'] == 'not_configured'
    assert report['data_source'] == 'demo'
    assert report['confirmed_damaged_part'] is None
    assert report['model_assessment']['component_prediction']['component_id'] == 'bearing'
    history = api.get(endpoint + '/diagnoses', headers=headers).json()
    assert history['total'] == 1 and history['items'][0]['id'] == report['id']
    assert api.get('/diagnostics/status', headers=headers).json()['models']['hardware'] is None
