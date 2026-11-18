import { useMemo, useState } from 'react';
import { collection, orderBy, query, where } from 'firebase/firestore';
import Modal from '../components/Modal.jsx';
import { db } from '../firebase.js';
import { callApi } from '../lib/api.js';
import { useCollection } from '../hooks/useCollection.js';
import { formatPeso, round2 } from '../lib/format.js';
import { unitPriceFor } from '../lib/pricing.js';

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash' },
  { id: 'gcash', label: 'GCash' },
];

export default function POS() {
  const categoriesQuery = useMemo(() => query(collection(db, 'categories'), orderBy('sortOrder')), []);
  const itemsQuery = useMemo(() => query(collection(db, 'menuItems'), where('available', '==', true)), []);
  const { docs: categories } = useCollection(categoriesQuery);
  const { docs: rawItems, loading } = useCollection(itemsQuery);
  const items = useMemo(() => [...rawItems].sort((a, b) => a.name.localeCompare(b.name)), [rawItems]);

  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [picking, setPicking] = useState(null);
  const [payment, setPayment] = useState('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);

  const term = search.trim().toLowerCase();
  const visibleItems = items.filter(
    (i) => (activeCategory === 'all' || i.categoryId === activeCategory) && i.name.toLowerCase().includes(term),
  );

  const total = round2(cart.reduce((sum, line) => sum + line.unitPrice * line.qty, 0));
  const cash = Number(cashReceived);
  const change = payment === 'cash' && cashReceived !== '' ? round2(cash - total) : null;
  const canCharge = cart.length > 0 && !submitting && (payment !== 'cash' || cash >= total);
  const quickCash = [
    { label: 'Exact', value: total },
    ...[100, 200, 500, 1000].filter((v) => v > total).slice(0, 3).map((v) => ({ label: formatPeso(v), value: v })),
  ];

  function addToCart(item, sizeName = null, addOnNames = [], qty = 1) {
    const key = [item.id, sizeName ?? '', [...addOnNames].sort().join('+')].join('|');
    const unitPrice = unitPriceFor(item, sizeName, addOnNames);
    setCart((current) => {
      if (current.some((line) => line.key === key)) {
        return current.map((line) => (line.key === key ? { ...line, qty: Math.min(99, line.qty + qty) } : line));
      }
      return [...current, { key, menuItemId: item.id, name: item.name, sizeName, addOnNames, unitPrice, qty }];
    });
    setError('');
  }

  function onItemClick(item) {
    if (item.sizes?.length || item.addOns?.length) setPicking(item);
    else addToCart(item);
  }

  function changeQty(key, delta) {
    setCart((current) =>
      current
        .map((line) => (line.key === key ? { ...line, qty: Math.min(99, line.qty + delta) } : line))
        .filter((line) => line.qty > 0),
    );
  }

  async function charge() {
    setSubmitting(true);
    setError('');
    try {
      const data = await callApi('complete-order', {
        items: cart.map(({ menuItemId, sizeName, addOnNames, qty }) => ({ menuItemId, sizeName, addOnNames, qty })),
        paymentMethod: payment,
        cashReceived: payment === 'cash' ? cash : null,
      });
      setReceipt(data);
      setCart([]);
      setCashReceived('');
    } catch (err) {
      setError(err.message || 'Could not complete the order.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pos">
      <section className="pos-menu">
        <header className="page-header">
          <h1>Point of Sale</h1>
          <input
            className="input search"
            placeholder="Search menu…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </header>

        <div className="chips">
          <button
            className={`chip${activeCategory === 'all' ? ' active' : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={`chip${activeCategory === c.id ? ' active' : ''}`}
              onClick={() => setActiveCategory(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="muted">Loading menu…</p>
        ) : (
          <div className="item-grid">
            {visibleItems.map((item) => (
              <button key={item.id} className="item-card" onClick={() => onItemClick(item)}>
                <span className="item-name">{item.name}</span>
                <span className="item-price">{formatPeso(item.price)}</span>
                {(item.sizes?.length > 0 || item.addOns?.length > 0) && (
                  <span className="item-hint">Options</span>
                )}
              </button>
            ))}
            {visibleItems.length === 0 && <p className="muted">No items match.</p>}
          </div>
        )}
      </section>

      <aside className="pos-cart card">
        <h2>Current order</h2>

        {cart.length === 0 ? (
          <p className="muted">Tap an item to add it.</p>
        ) : (
          <ul className="cart-lines">
            {cart.map((line) => (
              <li key={line.key} className="cart-line">
                <div className="cart-line-info">
                  <div className="cart-line-name">{line.name}</div>
                  {(line.sizeName || line.addOnNames.length > 0) && (
                    <div className="muted small">{[line.sizeName, ...line.addOnNames].filter(Boolean).join(' · ')}</div>
                  )}
                </div>
                <div className="qty">
                  <button className="icon-btn" onClick={() => changeQty(line.key, -1)} aria-label="Decrease">
                    −
                  </button>
                  <span>{line.qty}</span>
                  <button className="icon-btn" onClick={() => changeQty(line.key, 1)} aria-label="Increase">
                    +
                  </button>
                </div>
                <div className="cart-line-total">{formatPeso(line.unitPrice * line.qty)}</div>
              </li>
            ))}
          </ul>
        )}

        <div className="cart-total">
          <span>Total</span>
          <strong>{formatPeso(total)}</strong>
        </div>

        <div className="segmented">
          {PAYMENT_METHODS.map((m) => (
            <button key={m.id} className={payment === m.id ? 'active' : ''} onClick={() => setPayment(m.id)}>
              {m.label}
            </button>
          ))}
        </div>

        {payment === 'cash' && (
          <>
            <label className="field">
              <span>Cash received</span>
              <input
                className="input"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
              />
            </label>
            <div className="row wrap">
              {quickCash.map((q) => (
                <button
                  key={q.label}
                  className="btn btn-ghost small"
                  disabled={total === 0}
                  onClick={() => setCashReceived(String(q.value))}
                >
                  {q.label}
                </button>
              ))}
            </div>
            {change !== null && (
              <div className={`change${change < 0 ? ' negative' : ''}`}>
                <span>{change < 0 ? 'Short by' : 'Change'}</span>
                <strong>{formatPeso(Math.abs(change))}</strong>
              </div>
            )}
          </>
        )}

        {error && <div className="alert">{error}</div>}

        <button className="btn btn-primary btn-block btn-lg" disabled={!canCharge} onClick={charge}>
          {submitting ? 'Processing…' : `Charge ${formatPeso(total)}`}
        </button>
        {cart.length > 0 && (
          <button className="btn btn-ghost btn-block" onClick={() => setCart([])} disabled={submitting}>
            Clear order
          </button>
        )}
      </aside>

      {picking && (
        <ItemPicker
          item={picking}
          onClose={() => setPicking(null)}
          onAdd={(...args) => {
            addToCart(picking, ...args);
            setPicking(null);
          }}
        />
      )}

      {receipt && <Receipt receipt={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}

function ItemPicker({ item, onAdd, onClose }) {
  const [sizeName, setSizeName] = useState(item.sizes?.[0]?.name ?? null);
  const [addOnNames, setAddOnNames] = useState([]);
  const [qty, setQty] = useState(1);
  const unitPrice = unitPriceFor(item, sizeName, addOnNames);

  const toggleAddOn = (name) =>
    setAddOnNames((current) => (current.includes(name) ? current.filter((n) => n !== name) : [...current, name]));

  return (
    <Modal
      title={item.name}
      onClose={onClose}
      footer={
        <button className="btn btn-primary btn-block" onClick={() => onAdd(sizeName, addOnNames, qty)}>
          Add {qty} · {formatPeso(unitPrice * qty)}
        </button>
      }
    >
      {item.sizes?.length > 0 && (
        <fieldset className="option-group">
          <legend>Size</legend>
          {item.sizes.map((size) => (
            <label key={size.name} className="option">
              <input
                type="radio"
                name="size"
                checked={sizeName === size.name}
                onChange={() => setSizeName(size.name)}
              />
              <span>{size.name}</span>
              <span className="muted">{size.priceDelta ? `+${formatPeso(size.priceDelta)}` : ''}</span>
            </label>
          ))}
        </fieldset>
      )}

      {item.addOns?.length > 0 && (
        <fieldset className="option-group">
          <legend>Add-ons</legend>
          {item.addOns.map((addOn) => (
            <label key={addOn.name} className="option">
              <input
                type="checkbox"
                checked={addOnNames.includes(addOn.name)}
                onChange={() => toggleAddOn(addOn.name)}
              />
              <span>{addOn.name}</span>
              <span className="muted">+{formatPeso(addOn.price)}</span>
            </label>
          ))}
        </fieldset>
      )}

      <div className="qty qty-lg">
        <button className="icon-btn" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease">
          −
        </button>
        <span>{qty}</span>
        <button className="icon-btn" onClick={() => setQty((q) => Math.min(99, q + 1))} aria-label="Increase">
          +
        </button>
      </div>
    </Modal>
  );
}

function Receipt({ receipt, onClose }) {
  return (
    <Modal
      title={`Order #${receipt.orderNumber}`}
      onClose={onClose}
      footer={
        <button className="btn btn-primary btn-block" onClick={onClose}>
          New order
        </button>
      }
    >
      <div className="receipt">
        {receipt.lines.map((line, i) => (
          <div key={i} className="receipt-line">
            <span>
              {line.qty}× {line.name}
              {(line.sizeName || line.addOnNames.length > 0) && (
                <span className="muted small"> ({[line.sizeName, ...line.addOnNames].filter(Boolean).join(', ')})</span>
              )}
            </span>
            <span>{formatPeso(line.lineTotal)}</span>
          </div>
        ))}
        <div className="receipt-line total">
          <span>Total</span>
          <span>{formatPeso(receipt.total)}</span>
        </div>
        <div className="receipt-line">
          <span>Paid ({receipt.paymentMethod === 'cash' ? 'Cash' : 'GCash'})</span>
          <span>{formatPeso(receipt.paymentMethod === 'cash' ? receipt.cashReceived : receipt.total)}</span>
        </div>
        {receipt.paymentMethod === 'cash' && (
          <div className="receipt-line">
            <span>Change</span>
            <span>{formatPeso(receipt.change)}</span>
          </div>
        )}
      </div>

      {receipt.lowStock?.length > 0 && (
        <div className="alert warning">
          <strong>Low stock:</strong>{' '}
          {receipt.lowStock.map((s) => `${s.name} (${s.stock} ${s.unit} left)`).join(', ')}
        </div>
      )}
    </Modal>
  );
}
