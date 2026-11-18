import { useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import Modal from '../components/Modal.jsx';
import { db } from '../firebase.js';
import { useCollection } from '../hooks/useCollection.js';
import { formatPeso } from '../lib/format.js';

export default function Menu() {
  const categoriesQuery = useMemo(() => query(collection(db, 'categories'), orderBy('sortOrder')), []);
  const itemsQuery = useMemo(() => query(collection(db, 'menuItems'), orderBy('name')), []);
  const { docs: categories } = useCollection(categoriesQuery);
  const { docs: items, loading } = useCollection(itemsQuery);

  const [newCategory, setNewCategory] = useState('');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null); // item being edited, {} for a new one
  const [error, setError] = useState('');

  const categoryName = (id) => categories.find((c) => c.id === id)?.name ?? '—';
  const visibleItems = filter === 'all' ? items : items.filter((i) => i.categoryId === filter);

  async function run(action) {
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err.message);
    }
  }

  function addCategory(e) {
    e.preventDefault();
    const name = newCategory.trim();
    if (!name) return;
    const sortOrder = categories.reduce((max, c) => Math.max(max, c.sortOrder ?? 0), 0) + 1;
    run(async () => {
      await addDoc(collection(db, 'categories'), { name, sortOrder });
      setNewCategory('');
    });
  }

  function renameCategory(category, value) {
    const name = value.trim();
    if (!name || name === category.name) return;
    run(() => updateDoc(doc(db, 'categories', category.id), { name }));
  }

  function deleteCategory(category) {
    if (items.some((i) => i.categoryId === category.id)) {
      setError(`Move or delete the items in "${category.name}" before deleting it.`);
      return;
    }
    if (!window.confirm(`Delete the category "${category.name}"?`)) return;
    run(() => deleteDoc(doc(db, 'categories', category.id)));
  }

  function toggleAvailable(item) {
    run(() =>
      updateDoc(doc(db, 'menuItems', item.id), {
        available: !item.available,
        updatedAt: serverTimestamp(),
      }),
    );
  }

  function deleteItem(item) {
    if (!window.confirm(`Delete "${item.name}" from the menu?`)) return;
    run(() => deleteDoc(doc(db, 'menuItems', item.id)));
  }

  async function saveItem(form) {
    const { id, createdAt, updatedAt, ...data } = form;
    if (id) {
      await setDoc(doc(db, 'menuItems', id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
    } else {
      await addDoc(collection(db, 'menuItems'), {
        ...data,
        recipe: data.recipe ?? [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    setEditing(null);
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Menu</h1>
          <p className="muted">Categories, items, sizes and add-ons.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({})} disabled={!categories.length}>
          + New item
        </button>
      </header>

      {error && <div className="alert">{error}</div>}

      <div className="split">
        <section className="card">
          <h2>Categories</h2>
          <ul className="list">
            {categories.map((cat) => (
              <li key={cat.id} className="list-row">
                <input
                  key={cat.name}
                  className="input input-inline"
                  defaultValue={cat.name}
                  aria-label="Category name"
                  onBlur={(e) => renameCategory(cat, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                />
                <span className="muted small">{items.filter((i) => i.categoryId === cat.id).length}</span>
                <button className="icon-btn" onClick={() => deleteCategory(cat)} aria-label={`Delete ${cat.name}`}>
                  🗑
                </button>
              </li>
            ))}
          </ul>
          <form className="row" onSubmit={addCategory}>
            <input
              className="input"
              placeholder="New category"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <button className="btn">Add</button>
          </form>
        </section>

        <section className="card">
          <div className="chips">
            <button className={`chip${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                className={`chip${filter === c.id ? ' active' : ''}`}
                onClick={() => setFilter(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="muted">Loading…</p>
          ) : visibleItems.length === 0 ? (
            <p className="muted">No items yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th className="num">Price</th>
                  <th>Options</th>
                  <th>Available</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr key={item.id} className={item.available ? '' : 'dimmed'}>
                    <td>{item.name}</td>
                    <td>{categoryName(item.categoryId)}</td>
                    <td className="num">{formatPeso(item.price)}</td>
                    <td className="muted small">
                      {item.sizes?.length || 0} sizes · {item.addOns?.length || 0} add-ons
                    </td>
                    <td>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={Boolean(item.available)}
                          onChange={() => toggleAvailable(item)}
                        />
                        <span />
                      </label>
                    </td>
                    <td className="actions">
                      <button className="btn btn-ghost small" onClick={() => setEditing(item)}>
                        Edit
                      </button>
                      <button className="btn btn-ghost small danger" onClick={() => deleteItem(item)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {editing && (
        <ItemForm item={editing} categories={categories} onSave={saveItem} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function ItemForm({ item, categories, onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    name: '',
    categoryId: categories[0]?.id ?? '',
    price: '',
    available: true,
    sizes: [],
    addOns: [],
    ...item,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const updateRow = (key, index, patch) =>
    setForm((f) => ({ ...f, [key]: f[key].map((row, i) => (i === index ? { ...row, ...patch } : row)) }));
  const removeRow = (key, index) => setForm((f) => ({ ...f, [key]: f[key].filter((_, i) => i !== index) }));
  const addRow = (key, blank) => setForm((f) => ({ ...f, [key]: [...f[key], blank] }));

  async function submit(e) {
    e.preventDefault();
    const name = form.name.trim();
    const price = Number(form.price);
    if (!name) return setError('Name is required.');
    if (!form.categoryId) return setError('Pick a category.');
    if (form.price === '' || !(price >= 0)) return setError('Price must be 0 or more.');

    // Keep any existing per-size / per-add-on recipe data (edited in the Inventory module).
    const sizes = form.sizes
      .filter((s) => s.name.trim())
      .map((s) => ({ ...s, name: s.name.trim(), priceDelta: Number(s.priceDelta) || 0 }));
    const addOns = form.addOns
      .filter((a) => a.name.trim())
      .map((a) => ({ ...a, name: a.name.trim(), price: Number(a.price) || 0 }));

    setSaving(true);
    setError('');
    try {
      await onSave({ ...form, name, price, sizes, addOns });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title={item.id ? `Edit ${item.name}` : 'New menu item'}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="item-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save item'}
          </button>
        </>
      }
    >
      <form id="item-form" className="stack" onSubmit={submit}>
        <div className="grid-2">
          <label className="field">
            <span>Name</span>
            <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
          </label>
          <label className="field">
            <span>Category</span>
            <select className="input" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Base price (₱)</span>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => set('price', e.target.value)}
            />
          </label>
          <label className="field checkbox-field">
            <input type="checkbox" checked={form.available} onChange={(e) => set('available', e.target.checked)} />
            <span>Available for sale</span>
          </label>
        </div>

        <fieldset className="option-editor">
          <legend>Sizes</legend>
          {form.sizes.map((size, i) => (
            <div className="row" key={i}>
              <input
                className="input"
                placeholder="e.g. 16oz"
                value={size.name}
                onChange={(e) => updateRow('sizes', i, { name: e.target.value })}
              />
              <input
                className="input input-sm"
                type="number"
                step="0.01"
                placeholder="+₱"
                value={size.priceDelta}
                onChange={(e) => updateRow('sizes', i, { priceDelta: e.target.value })}
                aria-label="Price change"
              />
              <button type="button" className="icon-btn" onClick={() => removeRow('sizes', i)} aria-label="Remove size">
                ×
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost small" onClick={() => addRow('sizes', { name: '', priceDelta: 0 })}>
            + Add size
          </button>
        </fieldset>

        <fieldset className="option-editor">
          <legend>Add-ons</legend>
          {form.addOns.map((addOn, i) => (
            <div className="row" key={i}>
              <input
                className="input"
                placeholder="e.g. Extra shot"
                value={addOn.name}
                onChange={(e) => updateRow('addOns', i, { name: e.target.value })}
              />
              <input
                className="input input-sm"
                type="number"
                step="0.01"
                placeholder="₱"
                value={addOn.price}
                onChange={(e) => updateRow('addOns', i, { price: e.target.value })}
                aria-label="Add-on price"
              />
              <button type="button" className="icon-btn" onClick={() => removeRow('addOns', i)} aria-label="Remove add-on">
                ×
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost small" onClick={() => addRow('addOns', { name: '', price: 0 })}>
            + Add add-on
          </button>
        </fieldset>

        <p className="muted small">
          Recipes (ingredients used per cup) are managed in the Inventory module. Existing recipes are kept when you save.
        </p>
        {error && <div className="alert">{error}</div>}
      </form>
    </Modal>
  );
}
