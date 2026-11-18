import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';

/**
 * Live-subscribes to a Firestore query.
 * Pass a query built with useMemo (or null to skip) so it isn't re-created every render.
 */
export function useCollection(firestoreQuery) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(Boolean(firestoreQuery));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!firestoreQuery) {
      setDocs([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    return onSnapshot(
      firestoreQuery,
      (snap) => {
        setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
  }, [firestoreQuery]);

  return { docs, loading, error };
}
