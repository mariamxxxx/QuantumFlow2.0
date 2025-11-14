"""
qml_worker.py
Flask-based Qiskit worker for quantum/classical kernel computations and dataset generation.
Run: `python qml_worker.py` (install requirements in python/requirements.txt first)
"""

from flask import Flask, request, jsonify
from sklearn import datasets
from sklearn.metrics.pairwise import rbf_kernel, polynomial_kernel
import numpy as np
import time
import hashlib
import json

from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector

app = Flask(__name__)

# simple in-memory cache
_CACHE = {}

def cache_response(key, value):
  _CACHE[key] = value

def get_cached(key):
  return _CACHE.get(key)

def make_cache_key(body):
  s = json.dumps(body, sort_keys=True)
  return hashlib.sha256(s.encode()).hexdigest()

def build_angle_feature_map(x, n_qubits, layers=1, scaling=1.0):
  """Build a simple angle-encoding feature map and return a Statevector."""
  qc = QuantumCircuit(n_qubits)
  # map features to qubit rotations
  for layer in range(layers):
    for q in range(n_qubits):
      val = scaling * float(x[q % len(x)])
      qc.ry(val, q)
      qc.rz(val * 0.5, q)
    # entangling (simple chain)
    for q in range(n_qubits - 1):
      qc.cz(q, q + 1)
  # return statevector
  sv = Statevector.from_instruction(qc)
  return sv

def compute_kernel_matrix(statevectors):
  n = len(statevectors)
  K = np.zeros((n, n), dtype=float)
  for i in range(n):
    vi = statevectors[i].data
    for j in range(i, n):
      vj = statevectors[j].data
      inner = np.vdot(vi, vj)
      val = float(np.abs(inner) ** 2)
      K[i, j] = val
      K[j, i] = val
  return K

@app.route('/generate-dataset', methods=['POST'])
def generate_dataset():
  try:
    body = request.get_json() or {}
    dtype = body.get('type', 'moons')
    n = int(body.get('n', 100))
    if n <= 0 or n > 10000:
      return jsonify(error='n must be between 1 and 10000'), 400

    if dtype == 'moons':
      X, y = datasets.make_moons(n_samples=n, noise=0.1)
    elif dtype == 'circles':
      X, y = datasets.make_circles(n_samples=n, noise=0.05, factor=0.5)
    elif dtype == 'blobs':
      X, y = datasets.make_blobs(n_samples=n, centers=3, n_features=2)
    else:
      return jsonify(error='unknown dataset type'), 400

    return jsonify(X=X.tolist(), y=y.tolist())
  except Exception as e:
    return jsonify(error=str(e)), 500

@app.route('/qkernel', methods=['POST'])
def qkernel():
  try:
    body = request.get_json() or {}
    key = make_cache_key(body)
    cached = get_cached(key)
    if cached:
      return jsonify(cached)

    dataset = body.get('dataset')
    fmap = body.get('feature_map', {})
    options = body.get('options', {})

    if not dataset or 'X' not in dataset:
      return jsonify(error='dataset with X required'), 400

    X = np.array(dataset['X'], dtype=float)
    n_qubits = int(fmap.get('n_qubits', 2))
    if n_qubits > 6:
      return jsonify(error='n_qubits exceeds supported limit (6)'), 400

    fmap_type = fmap.get('type', 'angle')
    layers = int(fmap.get('layers', 1))
    scaling = float(fmap.get('scaling', 1.0))

    simulator = options.get('simulator', 'statevector')
    shots = int(options.get('shots', 0))

    start = time.time()

    # prepare statevectors for each sample
    svs = []
    for xi in X:
      if fmap_type in ('angle', 'custom'):
        sv = build_angle_feature_map(xi, n_qubits, layers, scaling)
      elif fmap_type == 'iqp':
        # reuse angle map but entangling different pattern if desired
        sv = build_angle_feature_map(xi, n_qubits, layers, scaling)
      else:
        return jsonify(error='unknown feature_map type'), 400
      svs.append(sv)

    # note: qasm approx not implemented fully; fallback to statevector
    if simulator == 'qasm' and shots > 0:
      message = 'qasm with shots requested; returning statevector-based overlaps (approximate for qasm).' 
    else:
      message = 'statevector overlaps'

    K = compute_kernel_matrix(svs)
    runtime_s = time.time() - start

    result = {
      'kernel_matrix': K.tolist(),
      'metadata': { 'runtime_s': runtime_s, 'simulator': simulator, 'note': message }
    }

    cache_response(key, result)
    return jsonify(result)
  except Exception as e:
    return jsonify(error=str(e)), 500

@app.route('/classical-kernel', methods=['POST'])
def classical_kernel():
  try:
    body = request.get_json() or {}
    dataset = body.get('dataset')
    kernel = body.get('kernel', 'rbf')
    gamma = body.get('gamma', None)

    if not dataset or 'X' not in dataset:
      return jsonify(error='dataset with X required'), 400

    X = np.array(dataset['X'], dtype=float)

    if kernel == 'rbf':
      K = rbf_kernel(X, X, gamma=gamma)
    elif kernel == 'poly' or kernel == 'polynomial':
      K = polynomial_kernel(X, X, gamma=gamma, degree=3)
    else:
      return jsonify(error='unsupported kernel'), 400

    return jsonify({ 'kernel_matrix': K.tolist() })
  except Exception as e:
    return jsonify(error=str(e)), 500

if __name__ == '__main__':
  app.run(host='0.0.0.0', port=5001)
