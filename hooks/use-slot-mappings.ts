import { useEffect, useState } from 'react';

export type SlotMapping = {
    slotMode: 'simulator' | 'brand';
    brandRefSource: 'screenshot_ref' | 'picked_export_icon' | null;
    brandRefId: string | null;
    simShotId: string | null;
    styleRefAssetId: string | null;
};

type StoredSlotMapping = Partial<SlotMapping>;
type StoredSlotMappingsBySetId = Record<string, Record<number, StoredSlotMapping>>;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeSlotMappingRecord = (value: unknown): Record<number, StoredSlotMapping> => {
    if (!isPlainObject(value)) return {};
    const out: Record<number, StoredSlotMapping> = {};
    for (const [key, entry] of Object.entries(value)) {
        const slotIndex = Number(key);
        if (!Number.isInteger(slotIndex) || slotIndex < 1 || !isPlainObject(entry)) continue;
        out[slotIndex] = { ...entry } as StoredSlotMapping;
    }
    return out;
};

const readStoredSlotMappings = (raw: string | null): {
    bySetId: StoredSlotMappingsBySetId;
    legacy: Record<number, StoredSlotMapping>;
} => {
    if (!raw) return { bySetId: {}, legacy: {} };
    try {
        const parsed = JSON.parse(raw);
        if (isPlainObject(parsed) && isPlainObject(parsed.bySetId)) {
            const bySetId: StoredSlotMappingsBySetId = {};
            for (const [setId, value] of Object.entries(parsed.bySetId)) {
                bySetId[setId] = normalizeSlotMappingRecord(value);
            }
            return { bySetId, legacy: {} };
        }
        return {
            bySetId: {},
            legacy: normalizeSlotMappingRecord(parsed),
        };
    } catch {
        return { bySetId: {}, legacy: {} };
    }
};

export const useSlotMappings = (selectedAppId: string | null) => {
    const [slotMappingsBySetId, setSlotMappingsBySetId] = useState<StoredSlotMappingsBySetId>({});
    const [legacySlotMappings, setLegacySlotMappings] = useState<Record<number, StoredSlotMapping>>({});

    useEffect(() => {
        if (!selectedAppId) {
            setSlotMappingsBySetId({});
            setLegacySlotMappings({});
            return;
        }
        const stored = window.localStorage.getItem(`zefgen.slotMappings.${selectedAppId}`);
        const parsed = readStoredSlotMappings(stored);
        setSlotMappingsBySetId(parsed.bySetId);
        setLegacySlotMappings(parsed.legacy);
    }, [selectedAppId]);

    useEffect(() => {
        if (!selectedAppId) return;
        window.localStorage.setItem(
            `zefgen.slotMappings.${selectedAppId}`,
            JSON.stringify({ bySetId: slotMappingsBySetId })
        );
    }, [selectedAppId, slotMappingsBySetId]);

    return {
        slotMappingsBySetId,
        setSlotMappingsBySetId,
        legacySlotMappings,
    };
};
