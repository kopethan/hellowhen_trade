'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { MediaAssetDto } from '@hellowhen/contracts';
import { MobilePage, PageIntro } from '../../../components/MobilePage';
import { api } from '../../../lib/api';
import { getFriendlyApiErrorMessage } from '../../../lib/webErrors';
import { countryOptions, currencyOptions, getDefaultCurrencyForCountry, isSupportedCurrency, type SupportedCurrency } from '../../../lib/webMoneyPreferences';
import { mediaSrc, normalizeMediaUpload } from '../../../features/inventory/inventoryPresentation';
import { assetUrl } from '../../../features/account/accountPresentation';
import { useWebAuth } from '../../../providers/WebAuthProvider';


const avatarSizePx = 512;

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

async function resizeAvatarForUpload(file: File) {
  const bitmap = await createImageBitmap(file);
  const sourceSize = Math.min(bitmap.width, bitmap.height);
  const sourceX = Math.max(0, Math.floor((bitmap.width - sourceSize) / 2));
  const sourceY = Math.max(0, Math.floor((bitmap.height - sourceSize) / 2));
  const canvas = document.createElement('canvas');
  canvas.width = avatarSizePx;
  canvas.height = avatarSizePx;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('Could not prepare this profile image. Try a different image.');
  }

  context.drawImage(bitmap, sourceX, sourceY, sourceSize, sourceSize, 0, 0, avatarSizePx, avatarSizePx);
  bitmap.close();

  const webpBlob = await canvasBlob(canvas, 'image/webp', 0.9);
  const blob = webpBlob ?? await canvasBlob(canvas, 'image/jpeg', 0.92);
  if (!blob) throw new Error('Could not prepare this profile image. Try a different image.');

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'profile-photo';
  const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `${baseName}.${extension}`, { type: blob.type, lastModified: Date.now() });
}

export default function AccountProfilePage() {
  const auth = useWebAuth();
  const profile = auth.user?.profile;
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [countryCode, setCountryCode] = useState('FR');
  const [preferredCurrency, setPreferredCurrency] = useState<SupportedCurrency>('eur');
  const [avatar, setAvatar] = useState<MediaAssetDto | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');
  const avatarPreviewUrlRef = useRef('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrlRef.current) URL.revokeObjectURL(avatarPreviewUrlRef.current);
    };
  }, []);

  function replaceAvatarPreview(file: File) {
    if (avatarPreviewUrlRef.current) URL.revokeObjectURL(avatarPreviewUrlRef.current);
    const nextUrl = URL.createObjectURL(file);
    avatarPreviewUrlRef.current = nextUrl;
    setAvatarPreviewUrl(nextUrl);
  }

  function clearAvatarPreview() {
    if (avatarPreviewUrlRef.current) URL.revokeObjectURL(avatarPreviewUrlRef.current);
    avatarPreviewUrlRef.current = '';
    setAvatarPreviewUrl('');
  }

  useEffect(() => {
    setDisplayName(profile?.displayName ?? '');
    setHandle(profile?.handle ?? '');
    setBio(profile?.bio ?? '');
    setCountryCode(profile?.countryCode ?? 'FR');
    setPreferredCurrency(profile?.preferredCurrency ?? 'eur');
    setAvatar(null);
  }, [profile?.avatarMediaId, profile?.avatarUrl, profile?.bio, profile?.countryCode, profile?.displayName, profile?.handle, profile?.preferredCurrency]);

  async function uploadAvatar(file: File) {
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const preparedFile = await resizeAvatarForUpload(file);
      replaceAvatarPreview(preparedFile);
      const formData = new FormData();
      formData.append('image', preparedFile);
      const response = await api.media.uploadImage(formData);
      const media = normalizeMediaUpload(response);
      if (!media) throw new Error('Upload completed but no image was returned.');
      const nextProfile = await api.profile.updateMe({ avatarMediaId: media.id, avatarUrl: media.url });
      setAvatar(media);
      auth.updateLocalProfile(nextProfile as Partial<NonNullable<typeof profile>>);
      setMessage('Profile photo uploaded for review. We resized it to a square preview.');
    } catch (caughtError) {
      setError(caughtError instanceof Error && caughtError.message.startsWith('Could not prepare') ? caughtError.message : getFriendlyApiErrorMessage(caughtError));
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const nextProfile = await api.profile.updateMe({ removeAvatar: true });
      setAvatar(null);
      clearAvatarPreview();
      auth.updateLocalProfile(nextProfile as Partial<NonNullable<typeof profile>>);
      setMessage('Profile photo removed.');
    } catch (caughtError) {
      setError(getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (!displayName.trim()) throw new Error('Display name is required.');
      const nextProfile = await api.profile.updateMe({
        displayName: displayName.trim(),
        handle: handle.trim() || undefined,
        bio: bio.trim() || undefined,
        countryCode,
        preferredCurrency,
      });
      auth.updateLocalProfile(nextProfile as Partial<NonNullable<typeof profile>>);
      setMessage('Profile updated.');
    } catch (caughtError) {
      setError(caughtError instanceof Error && caughtError.message === 'Display name is required.' ? caughtError.message : getFriendlyApiErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  }

  const avatarUrl = avatarPreviewUrl || (avatar ? mediaSrc(avatar) : assetUrl(profile?.avatarUrl));
  const avatarInitial = displayName.trim().slice(0, 1).toUpperCase() || 'H';

  return (
    <MobilePage>
      <PageIntro
        eyebrow="Profile"
        title="Your public identity"
        body="Update your display profile, profile photo, country, and preferred currency for web."
      />

      {!auth.hydrated ? (
        <section className="mobile-card mobile-card--soft"><p>Loading your session...</p></section>
      ) : null}

      {auth.hydrated && !auth.isAuthenticated ? (
        <section className="mobile-card mobile-card--soft">
          <h3>Login required</h3>
          <p>Sign in before editing your profile, country, or preferred currency.</p>
          <Link href="/auth" className="button primary full">Login or register</Link>
        </section>
      ) : null}

      {auth.isAuthenticated ? (
        <section className="mobile-card profile-form-card">
          <div className="profile-photo-panel">
            <div className="account-avatar account-avatar--large" aria-hidden="true">
              {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{avatarInitial}</span>}
            </div>
            <div>
              <h3>Profile photo</h3>
              <p>Upload a JPEG, PNG, or WEBP image. We center-crop and resize it to a 512×512 square before upload, then send it through the same media review flow as Need/Offer images.</p>
              <div className="mobile-actions">
                <label className="image-upload-button">
                  {uploading ? 'Uploading...' : 'Upload photo'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.currentTarget.value = '';
                    if (file) void uploadAvatar(file);
                  }} />
                </label>
                {avatarUrl ? <button type="button" className="secondary" disabled={saving} onClick={() => { void removeAvatar(); }}>Remove</button> : null}
              </div>
              {avatar?.status ? <span className="semantic-badge instruction">{avatar.status.replace(/_/g, ' ')}</span> : null}
            </div>
          </div>

          <div className="form-stack">
            <label className="field-label">
              Display name
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" />
            </label>
            <label className="field-label">
              Handle
              <input value={handle} onChange={(event) => setHandle(event.target.value)} placeholder="username" autoCapitalize="none" />
            </label>
            <label className="field-label">
              Bio
              <textarea value={bio} onChange={(event) => setBio(event.target.value)} placeholder="What do you like to trade?" rows={4} maxLength={280} />
            </label>

            <div className="preference-panel">
              <div>
                <h3>Country and currency</h3>
                <p>Country and preferred currency help localize trade display and keep future money features ready. No full address is collected yet.</p>
              </div>
              <label className="field-label">
                Country
                <select
                  value={countryCode}
                  onChange={(event) => {
                    const nextCountry = event.target.value;
                    setCountryCode(nextCountry);
                    setPreferredCurrency(getDefaultCurrencyForCountry(nextCountry));
                  }}
                >
                  {countryOptions.map((country) => (
                    <option key={country.code} value={country.code}>{country.label} · default {country.currency.toUpperCase()}</option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                Preferred currency
                <select
                  value={preferredCurrency}
                  onChange={(event) => {
                    if (isSupportedCurrency(event.target.value)) setPreferredCurrency(event.target.value);
                  }}
                >
                  {currencyOptions.map((currency) => (
                    <option key={currency.code} value={currency.code}>{currency.label} · {currency.helper}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {message ? <p className="notice-box success">{message}</p> : null}
          {error ? <p className="notice-box danger">{error}</p> : null}
          <button type="button" onClick={() => { void saveProfile(); }} disabled={saving || uploading}>{saving ? 'Saving...' : 'Save profile'}</button>
        </section>
      ) : null}
    </MobilePage>
  );
}
