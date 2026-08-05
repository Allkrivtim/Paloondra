import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getTrack, deleteTrack, setTrackGroups } from '../../api/luckperms';
import { getErrorMessage } from '../../api/errors';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../context/DialogContext';
import { LuckPermsTrack } from '../../types';
import TrackEditor from './TrackEditor';
import Spinner from '../common/Spinner';

interface Props {
  name: string;
  allGroupNames: string[];
  onDeleted: () => void;
}

export default function TrackPanel({ name, allGroupNames, onDeleted }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const dialog = useDialog();
  const [track, setTrack] = useState<LuckPermsTrack | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setTrack(await getTrack(name));
    } catch (err) {
      setLoadError(getErrorMessage(err, t('luckperms.failedToLoadTrack')));
    } finally {
      setLoading(false);
    }
  }, [name, t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleSetGroups(groups: string[]) {
    setTrack(await setTrackGroups(name, groups));
  }

  async function handleDelete() {
    const confirmed = await dialog.confirm({
      title: t('luckperms.deleteTrackTitle', { name }),
      confirmLabel: t('luckperms.delete'),
      danger: true,
    });
    if (!confirmed) return;
    setDeleting(true);
    try {
      await deleteTrack(name);
      toast.success(t('luckperms.trackDeletedToast', { name }));
      onDeleted();
    } catch (err) {
      toast.error(getErrorMessage(err, t('luckperms.failedToDeleteTrack')));
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-panel-muted">
        <Spinner /> {t('luckperms.loading')}
      </div>
    );
  }
  if (loadError || !track) {
    return <p className="p-4 text-sm text-panel-danger">{loadError}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-mono text-lg font-semibold text-panel-text">{track.name}</h2>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-1.5 rounded-lg border border-panel-border px-3 py-1.5 text-xs font-medium text-panel-text transition hover:border-panel-danger hover:text-panel-danger disabled:opacity-50"
        >
          {deleting && <Spinner className="h-3 w-3" />}
          {t('luckperms.deleteTrack')}
        </button>
      </div>

      <div className="rounded-xl border border-panel-border bg-panel-surface p-4">
        <TrackEditor groups={track.groups} allGroupNames={allGroupNames} onSetGroups={handleSetGroups} />
      </div>
    </div>
  );
}
