import json
import numpy as np
from qml_worker import app


def test_qkernel_diagonal():
    client = app.test_client()
    # small dataset: two simple points
    dataset = {"X": [[0.1, 0.2], [0.15, 0.25]], "y": [0, 1]}
    body = {
        "dataset": dataset,
        "feature_map": { "type": "angle", "n_qubits": 2, "layers": 1, "scaling": 1.0 },
        "options": { "simulator": "statevector", "shots": 0 }
    }
    rv = client.post('/qkernel', data=json.dumps(body), content_type='application/json')
    assert rv.status_code == 200
    data = json.loads(rv.data)
    K = np.array(data['kernel_matrix'])
    # square matrix
    assert K.shape[0] == K.shape[1]
    # diagonal approx 1
    diag = np.diag(K)
    assert np.allclose(diag, np.ones_like(diag), atol=1e-6)
