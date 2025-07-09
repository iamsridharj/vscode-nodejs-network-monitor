import * as assert from 'assert';
import * as vscode from 'vscode';
import { RequestManager } from '../core/RequestManager';
import { NetworkEvent } from '../types';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('RequestManager should handle network events', () => {
    const requestManager = new RequestManager(100);

    const mockEvent: NetworkEvent = {
      type: 'request',
      id: 'test-1',
      timestamp: Date.now(),
      data: {
        method: 'GET',
        url: 'https://api.example.com/data',
        headers: { 'Content-Type': 'application/json' },
      },
    };

    requestManager.handleNetworkEvent(mockEvent);
    const requests = requestManager.getAllRequests();

    assert.strictEqual(requests.length, 1);
    assert.strictEqual(requests[0].method, 'GET');
    assert.strictEqual(requests[0].url, 'https://api.example.com/data');
  });

  test('RequestManager should enforce history limit', () => {
    const requestManager = new RequestManager(2);

    for (let i = 0; i < 5; i++) {
      const mockEvent: NetworkEvent = {
        type: 'request',
        id: `test-${i}`,
        timestamp: Date.now(),
        data: {
          method: 'GET',
          url: `https://api.example.com/data${i}`,
          headers: {},
        },
      };
      requestManager.handleNetworkEvent(mockEvent);
    }

    const requests = requestManager.getAllRequests();
    assert.strictEqual(requests.length, 2);
  });

  test('RequestManager should clear all requests', () => {
    const requestManager = new RequestManager(100);

    const mockEvent: NetworkEvent = {
      type: 'request',
      id: 'test-1',
      timestamp: Date.now(),
      data: {
        method: 'GET',
        url: 'https://api.example.com/data',
        headers: {},
      },
    };

    requestManager.handleNetworkEvent(mockEvent);
    requestManager.clearRequests();

    const requests = requestManager.getAllRequests();
    assert.strictEqual(requests.length, 0);
  });
});
