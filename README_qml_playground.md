# Quantum ML Playground — Run Instructions

This repository adds a small proxy (Node/Express), a Python Qiskit worker (Flask), and a React UI component to demonstrate quantum/classical kernel computations.

1) Start Python worker

```bash
cd python
python -m venv venv
# On mac/linux
source venv/bin/activate
# On Windows (PowerShell)
# venv\Scripts\Activate.ps1
pip install -r requirements.txt
python qml_worker.py
```

The worker listens on port `5001` by default.

2) Start Node proxy

```bash
cd backend
npm install
cp .env.example .env
# Edit .env to set ALLOWED_ORIGIN if needed
npm start
```

The proxy listens on port `4000` by default and forwards to the Python worker.

3) Start frontend

From the main frontend project run your usual dev command (this repo assumes a React app already exists):

```bash
cd frontend
npm run dev
```

4) Quick curl example (compute kernel)

Generate a small dataset then compute kernel:

```bash
curl -s -X POST http://localhost:4000/api/generate-dataset -H 'Content-Type: application/json' -d '{"type":"moons","n":10}' > ds.json
curl -s -X POST http://localhost:4000/api/qkernel -H 'Content-Type: application/json' -d @- <<'JSON'
{
  "dataset": $(jq -c . ds.json),
  "feature_map": { "type": "angle", "n_qubits": 2, "layers": 1, "scaling": 1.0 },
  "options": { "simulator": "statevector", "shots": 0 }
}
JSON
```

Expected response shape:

```json
{
  "kernel_matrix": [[1.0, ...], [...]],
  "metadata": { "runtime_s": 0.12, "simulator": "statevector", "note": "statevector overlaps" }
}
```
