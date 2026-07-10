import React, { useState, useEffect } from 'react';

import './App.css';

const API_BASE = 'https://new-ps-1.onrender.com';
// Simple format helper for dates
const formatDateTime = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + 
         date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};
// Component for the real-time active duration timer in the table
const ActiveTimer = ({ entryTime }) => {
  const [duration, setDuration] = useState('');
  useEffect(() => {
    const calculateTime = () => {
      const ms = new Date() - new Date(entryTime);
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      if (days > 0) {
        setDuration(`${days}d ${hours % 24}h`);
      } else if (hours > 0) {
        setDuration(`${hours}h ${minutes % 60}m`);
      } else if (minutes > 0) {
        setDuration(`${minutes}m ${seconds % 60}s`);
      } else {
        setDuration(`${seconds}s`);
      }
    };
    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [entryTime]);
  return <span>{duration}</span>;
};
function App() {
  // State variables
  const [slots, setSlots] = useState({
    bike: { total: 5, available: 5 },
    car: { total: 5, available: 5 },
    truck: { total: 2, available: 2 }
  });
  const [parkedVehicles, setParkedVehicles] = useState([]);
  
  // Form states
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('car');
  const [exitQuery, setExitQuery] = useState('');
  // Ticket/Receipt output
  const [activeTicket, setActiveTicket] = useState(null);
  const [ticketMode, setTicketMode] = useState(''); // 'parked' or 'exited'
  // Alert system
  const [alert, setAlert] = useState(null);
  // Fetch initial data
  useEffect(() => {
    fetchData();
  }, []);
  const fetchData = async () => {
    try {
      const [slotsRes, parkedRes] = await Promise.all([
        fetch(`${API_BASE}/slots`),
        fetch(`${API_BASE}/parked`)
      ]);
      
      if (slotsRes.ok && parkedRes.ok) {
        const slotsData = await slotsRes.json();
        const parkedData = await parkedRes.json();
        setSlots(slotsData);
        setParkedVehicles(parkedData);
      }
    } catch (err) {
      triggerAlert('error', 'Could not connect to backend server. Make sure it is running.');
    }
  };
  const triggerAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => {
      setAlert(null);
    }, 6000);
  };
  // Submit park form
  const handleParkSubmit = async (e) => {
    e.preventDefault();
    if (!vehicleNumber.trim()) {
      triggerAlert('error', 'Please enter a vehicle number');
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/park`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleNumber: vehicleNumber.trim(), vehicleType })
      });
      const data = await response.json();
      if (response.ok) {
        setActiveTicket(data.ticket);
        setTicketMode('parked');
        setVehicleNumber('');
        triggerAlert('success', `Vehicle ${data.ticket.vehicleNumber} parked successfully!`);
        fetchData();
      } else {
        triggerAlert('error', data.message || 'Failed to park vehicle');
      }
    } catch (err) {
      triggerAlert('error', 'Network error. Please try again.');
    }
  };
  // Submit checkout form
  const handleExitSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!exitQuery.trim()) {
      triggerAlert('error', 'Please enter a ticket ID or vehicle number');
      return;
    }
    const payload = {};
    if (exitQuery.toUpperCase().startsWith('TKT-')) {
      payload.ticketId = exitQuery.trim();
    } else {
      payload.vehicleNumber = exitQuery.trim();
    }
    try {
      const response = await fetch(`${API_BASE}/exit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (response.ok) {
        setActiveTicket(data.receipt);
        setTicketMode('exited');
        setExitQuery('');
        triggerAlert('success', `Vehicle checkout complete. Fare calculated.`);
        fetchData();
      } else {
        triggerAlert('error', data.message || 'Vehicle not found or already exited.');
      }
    } catch (err) {
      triggerAlert('error', 'Network error. Please try again.');
    }
  };
  // Checkout directly from table click
  const handleTableCheckout = async (ticketId) => {
    try {
      const response = await fetch(`${API_BASE}/exit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId })
      });
      const data = await response.json();
      if (response.ok) {
        setActiveTicket(data.receipt);
        setTicketMode('exited');
        triggerAlert('success', `Vehicle checkout complete. Fare calculated.`);
        fetchData();
      } else {
        triggerAlert('error', data.message || 'Failed to checkout vehicle.');
      }
    } catch (err) {
      triggerAlert('error', 'Network error. Please try again.');
    }
  };
  // Icon selector helpers
  const getVehicleIcon = (type) => {
    switch (type) {
      case 'bike': return '🏍️';
      case 'car': return '🚗';
      case 'truck': return '🚚';
      default: return '🚗';
    }
  };
  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="brand-section">
          <h1 className="brand-logo">Antigravity <span>Parking</span></h1>
        </div>
        <div className="status-badge">
          <div className="status-dot"></div>
          Live Connection Active
        </div>
      </header>
      {/* Alert Banner */}
      {alert && (
        <div className={`alert alert-${alert.type}`}>
          <span>{alert.type === 'success' ? '✅' : '⚠️'}</span>
          <span>{alert.message}</span>
        </div>
      )}
      {/* Slots Section */}
      <section className="availability-grid">
        {Object.entries(slots).map(([type, value]) => {
          const occupancyPercent = ((value.total - value.available) / value.total) * 100;
          return (
            <div key={type} className={`slot-card ${type}`}>
              <div className="card-info">
                <span className="card-title">
                  <span className="vehicle-icon">{getVehicleIcon(type)}</span>
                  {type}s
                </span>
                <span className="card-subtitle">Available Slots</span>
              </div>
              <div className="card-counter">
                <span className="available-count">{value.available}</span>
                <span className="total-count"> / {value.total}</span>
              </div>
              <div className="card-status-bar">
                <div 
                  className="card-status-fill" 
                  style={{ width: `${occupancyPercent}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </section>
      {/* Operations Panel */}
      <div className="workspace-grid">
        
        {/* Left Hand: Forms and Interactive Desk */}
        <section className="forms-stack">
          {/* Check-In Form */}
          <div className="glass-panel">
            <h2 className="panel-title">🟢 Vehicle Check-In</h2>
            <form onSubmit={handleParkSubmit}>
              <div className="form-group">
                <label htmlFor="vehicleNumber">Vehicle Number Plate</label>
                <div className="input-wrapper">
                  <span className="input-icon">🆔</span>
                  <input
                    id="vehicleNumber"
                    type="text"
                    className="text-input"
                    placeholder="e.g. KA-01-AB-1234"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Vehicle Type</label>
                <div className="type-select-grid">
                  {['bike', 'car', 'truck'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`type-option ${vehicleType === type ? 'selected' : ''}`}
                      onClick={() => setVehicleType(type)}
                    >
                      <span className="type-option-icon">{getVehicleIcon(type)}</span>
                      <span className="type-option-label">{type}</span>
                    </button>
                  ))}
                </div>
              </div>
              <button type="submit" className="btn-primary">
                Issue Parking Ticket
              </button>
            </form>
          </div>
          {/* Checkout Form */}
          <div className="glass-panel">
            <h2 className="panel-title">🔴 Vehicle Checkout</h2>
            <form onSubmit={handleExitSubmit}>
              <div className="form-group">
                <label htmlFor="checkoutInput">Ticket ID or Vehicle Number</label>
                <div className="input-wrapper">
                  <span className="input-icon">🎟️</span>
                  <input
                    id="checkoutInput"
                    type="text"
                    className="text-input"
                    placeholder="e.g. TKT-1001 or KA-01-AB-1234"
                    value={exitQuery}
                    onChange={(e) => setExitQuery(e.target.value)}
                  />
                </div>
              </div>
              <button type="submit" className="btn-secondary">
                Calculate & Process Checkout
              </button>
            </form>
          </div>
        </section>
        {/* Right Hand: Ticket / Receipt Display Screen */}
        <section className="glass-panel ticket-section">
          <h2 className="panel-title">🎫 Virtual Ticket Console</h2>
          <div className="ticket-container">
            {activeTicket ? (
              <div className="digital-ticket">
                <div className="ticket-header">
                  <h4>PARKING RECEIPT</h4>
                  <div className={`ticket-type-tag ${activeTicket.vehicleType || 'car'}`}>
                    {activeTicket.vehicleType || 'vehicle'}
                  </div>
                </div>
                <div className="ticket-body">
                  <div className="ticket-field">
                    <span className="label">Ticket Reference:</span>
                    <span className="value highlight">{activeTicket.ticketId}</span>
                  </div>
                  <div className="ticket-field">
                    <span className="label">Plate Number:</span>
                    <span className="value">{activeTicket.vehicleNumber}</span>
                  </div>
                  <div className="ticket-field">
                    <span className="label">Checked In:</span>
                    <span className="value">{formatDateTime(activeTicket.entryTime)}</span>
                  </div>
                  {ticketMode === 'exited' && (
                    <>
                      <div className="ticket-field">
                        <span className="label">Checked Out:</span>
                        <span className="value">{formatDateTime(activeTicket.exitTime)}</span>
                      </div>
                      <div className="ticket-field">
                        <span className="label">Duration Stayed:</span>
                        <span className="value">{activeTicket.durationHours} hr(s)</span>
                      </div>
                      <div className="ticket-field" style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <span className="label" style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Total Fare:</span>
                        <span className="value price">₹{activeTicket.amount}</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="ticket-footer">
                  <div className="barcode-visual"></div>
                  <span className={`ticket-badge ${ticketMode}`}>
                    {ticketMode === 'parked' ? 'ACTIVE / PARKED' : 'PAID & EXITED'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="ticket-empty">
                <div className="ticket-empty-icon">🎟️</div>
                <p>No active session selected.</p>
                <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Park a vehicle or search above to view receipt details.</p>
              </div>
            )}
          </div>
        </section>
      </div>
      {/* Live Table Section */}
      <section className="glass-panel">
        <h2 className="panel-title">📋 Live Parked Vehicles ({parkedVehicles.length})</h2>
        <div className="parked-table-container">
          {parkedVehicles.length > 0 ? (
            <table className="parked-table">
              <thead>
                <tr>
                  <th>Ticket ID</th>
                  <th>Vehicle Number</th>
                  <th>Type</th>
                  <th>Entry Time</th>
                  <th>Duration Parked</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {parkedVehicles.map((vehicle) => (
                  <tr key={vehicle.ticketId}>
                    <td style={{ fontWeight: '600', color: 'var(--color-primary)' }}>{vehicle.ticketId}</td>
                    <td style={{ fontFamily: 'var(--font-display)', fontWeight: '600' }}>{vehicle.vehicleNumber}</td>
                    <td>
                      <span className={`table-vehicle-type ${vehicle.vehicleType}`}>
                        {getVehicleIcon(vehicle.vehicleType)} {vehicle.vehicleType}
                      </span>
                    </td>
                    <td>{formatDateTime(vehicle.entryTime)}</td>
                    <td style={{ color: '#38bdf8', fontWeight: '500' }}>
                      <ActiveTimer entryTime={vehicle.entryTime} />
                    </td>
                    <td>
                      <button
                        className="table-action-btn"
                        onClick={() => handleTableCheckout(vehicle.ticketId)}
                      >
                        Checkout
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-table-state">
              <div className="empty-table-icon">🧘‍♂️</div>
              <p>The parking lot is currently empty.</p>
              <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Use the Check-In form to park a vehicle.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
export default App;