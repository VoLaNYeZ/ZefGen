import { useEffect, useState } from 'react';

export type SlotMapping = {
    brandRefSource: 'screenshot_ref' | 'picked_export_icon' | null;
    brandRefId: string | null;
    simShotId: string | null;
    styleRefAssetId: string | null;
};

export const useSlotMappings = (selectedAppId: string | null) => {
    const [slotMappings, setSlotMappings] = useState<Record<number, SlotMapping>>({});

    useEffect(() => {
        if (!selectedAppId) {
            setSlotMappings({});
            return;
        }
        const stored = window.localStorage.getItem(`zefgen.slotMappings.${selectedAppId}`);
        if (stored) {
            try {
                setSlotMappings(JSON.parse(stored));
            } catch {
                setSlotMappings({});
            }
        } else {
            setSlotMappings({});
        }
    }, [selectedAppId]);

    useEffect(() => {
        if (!selectedAppId) return;
        window.localStorage.setItem(`zefgen.slotMappings.${selectedAppId}`, JSON.stringify(slotMappings));
    }, [selectedAppId, slotMappings]);

    return {
        slotMappings,
        setSlotMappings,
    };
};
