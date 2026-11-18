import { Fragment, useMemo, useState } from 'react';
import { collection, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useCollection } from '../hooks/useCollection.js';
import { formatDateTime, formatPeso } from '../lib/format.js';

export default function Orders() {
  const ordersQuery = useMemo(() => query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(50)), []);
  const { docs: orders, loading, error } = useCollection(ordersQuery);
  const [openId, setOpenId] = useState(null);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Orders</h1>
          <p className="muted">The 50 most recent orders. Click a row to see its items.</p>
        </div>
      </header>

      {error && <div className="alert">{error.message}</div>}

      <section className="card">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="muted">No orders yet. Ring one up on the POS.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Time</th>
                <th>Items</th>
                <th>Payment</th>
                <th>Cashier</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const count = order.items?.reduce((n, l) => n + l.qty, 0) ?? 0;
                const isOpen = openId === order.id;
                return (
                  <Fragment key={order.id}>
                    <tr className="clickable" onClick={() => setOpenId(isOpen ? null : order.id)}>
                      <td>{order.orderNumber}</td>
                      <td>{formatDateTime(order.createdAt)}</td>
                      <td>
                        {count} item{count === 1 ? '' : 's'}
                      </td>
                      <td>
                        <span className={`pill pill-${order.paymentMethod}`}>
                          {order.paymentMethod === 'gcash' ? 'GCash' : 'Cash'}
                        </span>
                      </td>
                      <td>{order.cashierName}</td>
                      <td className="num">{formatPeso(order.total)}</td>
                    </tr>
                    {isOpen && (
                      <tr className="detail-row">
                        <td colSpan={6}>
                          {order.items.map((line, i) => (
                            <div key={i} className="receipt-line">
                              <span>
                                {line.qty}× {line.name}
                                {(line.sizeName || line.addOnNames?.length > 0) && (
                                  <span className="muted small">
                                    {' '}
                                    ({[line.sizeName, ...(line.addOnNames ?? [])].filter(Boolean).join(', ')})
                                  </span>
                                )}
                              </span>
                              <span>{formatPeso(line.lineTotal)}</span>
                            </div>
                          ))}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
