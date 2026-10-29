import json

import httpx
import pytest

import chat_service
from test_api import api, auth, motor_body
from test_diagnostics import bundle_dir, isolated_models, report_fixture


@pytest.fixture(autouse=True)
def no_live_cloud(monkeypatch):
    monkeypatch.setattr(chat_service, 'cloud_status', lambda: {'configured': False, 'model': 'test-model'})
    monkeypatch.setattr(chat_service, 'config', lambda name, default='': 'unit-test-key' if name == 'OLLAMA_API_KEY' else default)


def test_local_chat_is_grounded_and_labelled():
    report = report_fixture()
    result = chat_service.answer_question('Which part should I inspect?', report, [])
    assert result['provider'] == 'local_evidence'
    assert 'simulated' in result['reply']['answer'].lower()
    assert 'bearing' in result['reply']['answer'].lower()
    assert 'does not confirm' in result['reply']['answer'].lower()
    assert chat_service.answer_question('What is the health score?', report, [])['reply']['answer'].find('/100') > 0
    assert 'cannot establish' in chat_service.answer_question('Is it safe to keep running?', report, [])['reply']['answer']


def test_cloud_chat_uses_history_and_filters_unknown_evidence(monkeypatch):
    monkeypatch.setattr(chat_service, 'cloud_status', lambda: {'configured': True, 'model': 'test-model'})
    captured = {}
    reply = {'answer': 'The demo vibration evidence supports a bearing inspection; damage is not confirmed.', 'evidence_ids': ['vibration_rms']}
    class Client:
        def __init__(self, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def post(self, url, **kwargs):
            captured.update(kwargs)
            return httpx.Response(200, json={'message': {'content': json.dumps(reply)}})
    monkeypatch.setattr(chat_service.httpx, 'Client', Client)
    previous = [{'question': 'What happened?', 'answer': 'Temperature and vibration were above the demo limits.'}]
    result = chat_service.answer_question('Why should I inspect it?', report_fixture(), previous)
    assert result['provider'] == 'ollama_cloud'
    assert len(captured['json']['messages']) == 4
    assert captured['json']['messages'][1]['role'] == 'user'
    assert 'Private motor name' not in captured['json']['messages'][0]['content']
    assert 'coordinates' not in captured['json']['messages'][0]['content']
    assert 'format' not in captured['json']
    reply['evidence_ids'] = ['invented-reading']
    fallback = chat_service.answer_question('What happened?', report_fixture(), [])
    assert fallback['provider'] == 'local_evidence' and fallback['cloud_status'] == 'invalid_response'


def test_chat_cloud_timeout_falls_back(monkeypatch):
    monkeypatch.setattr(chat_service, 'cloud_status', lambda: {'configured': True, 'model': 'test-model'})
    class Client:
        def __init__(self, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def post(self, *args, **kwargs): raise httpx.ReadTimeout('private upstream details')
    monkeypatch.setattr(chat_service.httpx, 'Client', Client)
    response = chat_service.answer_question('What happened?', report_fixture(), [])
    assert response['cloud_status'] == 'timeout'
    assert response['provider'] == 'local_evidence'
    assert 'private upstream details' not in response['notice']


def test_chat_api_persistence_and_report_scope(api):
    headers = auth(api)
    motor = api.post('/motors', json={**motor_body(), 'source': 'demo'}, headers=headers).json()
    reading = {'motor_id': motor['id'], 'voltage': 230, 'waterflow': 10, 'density': 998, 'temperature': 73, 'environment_temperature': 30, 'humidity': 65}
    assert api.post('/readings', json=reading, headers=headers).status_code == 201
    report_response = api.post('/motors/' + motor['id'] + '/diagnose', json={'use_cloud': False}, headers=headers)
    assert report_response.status_code == 201, report_response.text
    report = report_response.json()
    endpoint = '/motors/' + motor['id'] + '/chat'
    body = {'message': 'What happened to this motor?', 'report_id': report['id']}
    assert api.post(endpoint, json=body).status_code == 401
    response = api.post(endpoint, json=body, headers=headers)
    assert response.status_code == 201, response.text
    assert response.json()['provider'] == 'local_evidence'
    history = api.get(endpoint + '?report_id=' + report['id'], headers=headers).json()
    assert history['total'] == 1 and history['items'][0]['id'] == response.json()['id']
    other = api.post('/motors', json={**motor_body(), 'motor_oid': 'OTHER'}, headers=headers).json()
    assert api.post('/motors/' + other['id'] + '/chat', json=body, headers=headers).status_code == 404
    assert api.post(endpoint, json={**body, 'message': '   '}, headers=headers).status_code == 422
