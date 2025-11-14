import React, { useState } from 'react'

export default function QMLPlayground() {
  const [datasetType, setDatasetType] = useState('moons')
  const [nSamples, setNSamples] = useState(50)
  const [featureMap, setFeatureMap] = useState('angle')
  const [nQubits, setNQubits] = useState(2)
  const [layers, setLayers] = useState(1)
  const [scaling, setScaling] = useState(1.0)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Update this if your proxy runs on a different port (e.g. 8000)
  const API = 'http://localhost:8000/api'

  const doGenerate = async () => {
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      const res = await fetch(`${API}/generate-dataset`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: datasetType, n: Number(nSamples) })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'generate failed')
      setResult({ dataset: json })
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  const doQKernel = async () => {
    setError(null)
    setLoading(true)
    try {
      if (nQubits > 6) throw new Error('n_qubits must be <= 6')
      if (!result || !result.dataset) throw new Error('Generate dataset first')

      const body = {
        dataset: result.dataset,
        feature_map: { type: featureMap, n_qubits: Number(nQubits), layers: Number(layers), scaling: Number(scaling) },
        options: { simulator: 'statevector', shots: 0 }
      }
      const res = await fetch(`${API}/qkernel`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'qkernel failed')
      setResult(prev => ({ ...prev, qkernel: json }))
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  const doClassical = async () => {
    setError(null)
    setLoading(true)
    try {
      if (!result || !result.dataset) throw new Error('Generate dataset first')
      const body = { dataset: result.dataset, kernel: 'rbf', gamma: null }
      const res = await fetch(`${API}/classical-kernel`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'classical kernel failed')
      setResult(prev => ({ ...prev, classical: json }))
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  return (
    <div style={{ padding: 12, fontFamily: 'sans-serif' }}>
      <h3>Quantum ML Playground</h3>

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ minWidth: 260 }}>
          <label>Dataset type</label>
          <select value={datasetType} onChange={e => setDatasetType(e.target.value)} style={{ width: '100%' }}>
            <option value="moons">moons</option>
            <option value="circles">circles</option>
            <option value="blobs">blobs</option>
          </select>

          <label>Samples</label>
          <input type="number" value={nSamples} onChange={e => setNSamples(e.target.value)} style={{ width: '100%' }} />

          <hr />

          <label>Feature map</label>
          <select value={featureMap} onChange={e => setFeatureMap(e.target.value)} style={{ width: '100%' }}>
            <option value="angle">angle</option>
            <option value="iqp">iqp</option>
            <option value="custom">custom</option>
          </select>

          <label>Qubits (max 6)</label>
          <input type="number" value={nQubits} onChange={e => setNQubits(Number(e.target.value))} min={1} max={6} style={{ width: '100%' }} />

          <label>Layers</label>
          <input type="number" value={layers} onChange={e => setLayers(Number(e.target.value))} min={1} style={{ width: '100%' }} />

          <label>Scaling</label>
          <input type="number" step="0.1" value={scaling} onChange={e => setScaling(Number(e.target.value))} style={{ width: '100%' }} />

          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button onClick={doGenerate}>Generate Dataset</button>
            <button onClick={doQKernel}>Quantum Kernel</button>
            <button onClick={doClassical}>Classical Kernel</button>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          {loading && <div>Loading...</div>}
          {error && <div style={{ color: 'red' }}>Error: {error}</div>}
          {result && (
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 12, marginTop: 8 }}>
              <strong>Result JSON:</strong>
              <pre style={{ maxHeight: 400, overflow: 'auto', background: '#f7f7f7', padding: 8 }}>
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
