import { useMemo } from 'react';
import { collection, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useCollection } from '../hooks/useCollection.js';
import { formatPeso, formatTime } from '../lib/format.js';

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
}

export default function Dashboard() {
  const todayQuery = useMemo(
    () =>
      query(collection(db, 'orders'), where('createdAt', '>=', startOfToday()), orderBy('createdAt', 'desc')),
    [],
  );
  const ingredientsQuery = useMemo(() => query(collection(db, 'ingredients'), orderBy('name')), []);
  const { docs: orders, loading } = useCollection(todayQuery);
  const { docs: ingredients } = useCollection(ingredientsQuery);

  const completed = useMemo(() => orders.filter((o) => o.status === 'completed'), [orders]);
  const sales = completed.reduce((sum, o) => sum + (o.total || 0), 0);
  const average = completed.length ? sales / completed.length : 0;
  const cups = completed.reduce((n, o) => n + (o.items?.reduce((m, l) => m + l.qty, 0) ?? 0), 0);

  const bestSellers = useMemo(() => {
    const totals = new Map();
    for (const order of completed) {
      for (const line of order.items ?? []) {
        const entry = totals.get(line.name) ?? { name: line.name, qty: 0, revenue: 0 };
        entry.qty += line.qty;
        entry.revenue += line.lineTotal;
        totals.set(line.name, entry);
      }
    }
    return [...totals.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [completed]);

  // Firestore can't compare two fields in a query, so filter low stock on the client.
  const lowStock = ingredients.filter((i) => Number(i.stock) <= Number(i.lowStockThreshold));

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">
            Today,{' '}
            {new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </header>

      <div className="stats">
        <Stat label="Sales today" value={formatPeso(sales)} />
        <Stat label="Orders" value={completed.length} />
        <Stat label="Average order" value={formatPeso(average)} />
        <Stat label="Items sold" value={cups} />
      </div>

      <div className="split">
        <section className="card">
          <h2>Best sellers today</h2>
          {bestSellers.length === 0 ? (
            <p className="muted">{loading ? 'Loading…' : 'No sales yet today.'}</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="num">Qty</th>
                  <th className="num">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {bestSellers.map((b) => (
                  <tr key={b.name}>
                    <td>{b.name}</td>
                    <td className="num">{b.qty}</td>
                    <td className="num">{formatPeso(b.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <h2>Low stock</h2>
          {lowStock.length === 0 ? (
            <p className="muted">All ingredients are above their reorder level.</p>
          ) : (
            <ul className="list">
              {lowStock.map((i) => (
                <li key={i.id} className="list-row">
                  <span>{i.name}</span>
                  <span className="pill pill-warn">
                    {i.stock} {i.unit} left
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt">Recent orders</h2>
          <ul className="list">
            {completed.slice(0, 5).map((o) => (
              <li key={o.id} className="list-row">
                <span>
                  #{o.orderNumber} · {formatTime(o.createdAt)}
                </span>
                <span>{formatPeso(o.total)}</span>
              </li>
            ))}
            {completed.length === 0 && <li className="muted">—</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="card stat">
      <div className="muted small">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
