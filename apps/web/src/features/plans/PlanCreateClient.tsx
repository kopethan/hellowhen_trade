'use client';

import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { getFriendlyApiErrorMessage } from '../../lib/webErrors';
import { useWebAuth } from '../../providers/WebAuthProvider';
import { PlansFeatureGate, PlansInternalBadge } from './PlansFeatureGate';

function toDateTimeLocalValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toIsoDateTime(value: string) {
  return new Date(value).toISOString();
}

export function PlanCreateClient() {
  const router = useRouter();
  const auth = useWebAuth();
  const defaultStartsAt = useMemo(() => toDateTimeLocalValue(new Date(Date.now() + 24 * 60 * 60 * 1000)), []);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Culture');
  const [locationLabel, setLocationLabel] = useState('Paris');
  const [mode, setMode] = useState<'local' | 'remote' | 'hybrid'>('local');
  const [startsAt, setStartsAt] = useState(defaultStartsAt);
  const [maxParticipants, setMaxParticipants] = useState('3');
  const [placeTitle, setPlaceTitle] = useState('Meeting point');
  const [placeNote, setPlaceNote] = useState('Short internal test stop.');
  const [placePublicAddress, setPlacePublicAddress] = useState('City area only');
  const [placePrivateAddress, setPlacePrivateAddress] = useState('Exact meeting point shown after approval.');
  const [status, setStatus] = useState<'draft' | 'open'>('open');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth.isAuthenticated) {
      router.push('/auth?next=/plans/new');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await api.plans.create({
        title,
        description,
        category: category.trim() || undefined,
        mode,
        locationLabel: locationLabel.trim() || undefined,
        startsAt: toIsoDateTime(startsAt),
        maxParticipants: maxParticipants ? Number(maxParticipants) : undefined,
        joinApprovalMode: 'owner_approval',
        status,
        places: placeTitle.trim() ? [{
          title: placeTitle,
          note: placeNote.trim() || undefined,
          addressPublicText: placePublicAddress.trim() || undefined,
          addressPrivateText: placePrivateAddress.trim() || undefined,
          startsAt: toIsoDateTime(startsAt),
          order: 0,
        }] : [],
      });
      router.replace(`/plans/${response.plan.id}`);
    } catch (saveError) {
      setError(getFriendlyApiErrorMessage(saveError, 'Could not create Plan.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PlansFeatureGate>
      <main className="mobile-page plans-page">
        <section className="page-intro">
          <div>
            <PlansInternalBadge />
            <h2>Create Plan</h2>
            <p>Internal-only form for testing Plans. Exact private location is hidden until join approval.</p>
          </div>
        </section>

        {!auth.hydrated ? <section className="mobile-card"><p className="meta">Checking session...</p></section> : null}
        {auth.hydrated && !auth.isAuthenticated ? (
          <section className="mobile-card mobile-card--soft">
            <h3>Log in required</h3>
            <p>Use a demo or internal account to create hidden Plans.</p>
            <button type="button" className="button primary" onClick={() => router.push('/auth?next=/plans/new')}>Log in</button>
          </section>
        ) : null}

        {auth.isAuthenticated ? (
          <form className="mobile-card plan-form" onSubmit={submit}>
            <label>
              <span>Title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} maxLength={120} required placeholder="Saturday in Paris" />
            </label>
            <label>
              <span>Description</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} maxLength={2000} required placeholder="Explain what you want to do and who can join." />
            </label>
            <div className="plan-form__row">
              <label>
                <span>Category</span>
                <input value={category} onChange={(event) => setCategory(event.target.value)} maxLength={80} />
              </label>
              <label>
                <span>Mode</span>
                <select value={mode} onChange={(event) => setMode(event.target.value as 'local' | 'remote' | 'hybrid')}>
                  <option value="local">In person</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </label>
            </div>
            <label>
              <span>City / area</span>
              <input value={locationLabel} onChange={(event) => setLocationLabel(event.target.value)} maxLength={160} />
            </label>
            <div className="plan-form__row">
              <label>
                <span>Starts at</span>
                <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required />
              </label>
              <label>
                <span>Max participants</span>
                <input type="number" min={1} max={100} value={maxParticipants} onChange={(event) => setMaxParticipants(event.target.value)} />
              </label>
            </div>
            <label>
              <span>Status</span>
              <select value={status} onChange={(event) => setStatus(event.target.value as 'draft' | 'open')}>
                <option value="open">Open for requests</option>
                <option value="draft">Draft</option>
              </select>
            </label>

            <hr />
            <h3>First place / stop</h3>
            <label>
              <span>Place title</span>
              <input value={placeTitle} onChange={(event) => setPlaceTitle(event.target.value)} maxLength={120} />
            </label>
            <label>
              <span>Public note</span>
              <textarea value={placeNote} onChange={(event) => setPlaceNote(event.target.value)} maxLength={1000} />
            </label>
            <label>
              <span>Public area</span>
              <input value={placePublicAddress} onChange={(event) => setPlacePublicAddress(event.target.value)} maxLength={160} />
            </label>
            <label>
              <span>Private exact detail</span>
              <input value={placePrivateAddress} onChange={(event) => setPlacePrivateAddress(event.target.value)} maxLength={240} />
            </label>

            {error ? <p className="form-error">{error}</p> : null}
            <button className="button primary full" type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create hidden Plan'}</button>
          </form>
        ) : null}
      </main>
    </PlansFeatureGate>
  );
}
