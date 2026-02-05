import React from 'react';
import type { GeneratedAsset, TextLayer } from '../../types/zefgen';
import { TranslationKey } from '../../i18n';

type EditPanelProps = {
    asset: GeneratedAsset;
    layers: TextLayer[];
    fonts: string[];
    editSaving: string | null;
    updateLayer: (assetId: string, layerId: string, patch: Partial<TextLayer>) => void;
    addLayer: (assetId: string) => void;
    removeLayer: (assetId: string, layerId: string) => void;
    handleSaveEdit: (assetId: string) => void;
    resetEditDraft: (asset: GeneratedAsset) => void;
    text: (key: TranslationKey) => string;
};

export const EditPanel = ({
    asset,
    layers,
    fonts,
    editSaving,
    updateLayer,
    addLayer,
    removeLayer,
    handleSaveEdit,
    resetEditDraft,
    text,
}: EditPanelProps) => {
    return (
        <div className="rounded-2xl bg-slate-950/70 ring-1 ring-white/5 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-indigo-200/70">{text('edit_layers')}</p>
                <button
                    type="button"
                    onClick={() => addLayer(asset.id)}
                    className="rounded-full border border-indigo-400/40 px-2.5 py-1 text-[10px] font-semibold text-indigo-100"
                >
                    {text('add_text_layer')}
                </button>
            </div>
            {layers.map((layer, index) => (
                <div key={layer.id} className="rounded-xl border border-indigo-500/20 bg-slate-950/40 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-indigo-200/70">{text('layer')} {index + 1}</p>
                        <button
                            type="button"
                            onClick={() => removeLayer(asset.id, layer.id)}
                            className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-indigo-200/60"
                            aria-label={text('delete')}
                        >
                            {text('delete')}
                        </button>
                    </div>
                    <div>
                        <label className="text-[10px] text-indigo-200/60">{text('text')}</label>
                        <textarea
                            value={layer.text}
                            onChange={(event) => updateLayer(asset.id, layer.id, { text: event.target.value })}
                            className="mt-1 w-full rounded-lg border border-indigo-500/20 bg-slate-950/60 px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                        />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                            <label className="text-[10px] text-indigo-200/60">{text('font')}</label>
                            <select
                                value={layer.font}
                                onChange={(event) => updateLayer(asset.id, layer.id, { font: event.target.value })}
                                className="mt-1 w-full rounded-lg border border-indigo-500/20 bg-slate-950/60 px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                            >
                                {fonts.map((font) => (
                                    <option key={font} value={font}>
                                        {font}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-indigo-200/60">{text('align')}</label>
                            <select
                                value={layer.align}
                                onChange={(event) => updateLayer(asset.id, layer.id, { align: event.target.value as TextLayer['align'] })}
                                className="mt-1 w-full rounded-lg border border-indigo-500/20 bg-slate-950/60 px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                            >
                                <option value="left">{text('align_left')}</option>
                                <option value="center">{text('align_center')}</option>
                                <option value="right">{text('align_right')}</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                        <div>
                            <label className="text-[10px] text-indigo-200/60">{text('size')}</label>
                            <input
                                type="number"
                                min={12}
                                max={160}
                                value={layer.size}
                                onChange={(event) => updateLayer(asset.id, layer.id, { size: Number(event.target.value) })}
                                className="mt-1 w-full rounded-lg border border-indigo-500/20 bg-slate-950/60 px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-indigo-200/60">{text('weight')}</label>
                            <input
                                type="number"
                                min={200}
                                max={900}
                                step={100}
                                value={layer.weight}
                                onChange={(event) => updateLayer(asset.id, layer.id, { weight: Number(event.target.value) })}
                                className="mt-1 w-full rounded-lg border border-indigo-500/20 bg-slate-950/60 px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-indigo-200/60">{text('color')}</label>
                            <input
                                type="color"
                                value={layer.color}
                                onChange={(event) => updateLayer(asset.id, layer.id, { color: event.target.value })}
                                className="mt-1 h-8 w-full rounded-lg border border-indigo-500/20 bg-slate-950/60 px-2 py-1"
                            />
                        </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                        <div>
                            <label className="text-[10px] text-indigo-200/60">{text('position_x')}</label>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={layer.x}
                                onChange={(event) => updateLayer(asset.id, layer.id, { x: Number(event.target.value) })}
                                className="mt-1 w-full"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-indigo-200/60">{text('position_y')}</label>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={layer.y}
                                onChange={(event) => updateLayer(asset.id, layer.id, { y: Number(event.target.value) })}
                                className="mt-1 w-full"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-indigo-200/60">{text('rotation')}</label>
                            <input
                                type="range"
                                min={-45}
                                max={45}
                                value={layer.rotation}
                                onChange={(event) => updateLayer(asset.id, layer.id, { rotation: Number(event.target.value) })}
                                className="mt-1 w-full"
                            />
                        </div>
                    </div>
                </div>
            ))}
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => handleSaveEdit(asset.id)}
                    disabled={editSaving === asset.id}
                    className="flex-1 rounded-xl bg-indigo-500/20 px-3 py-2 text-xs font-semibold text-indigo-100 border border-indigo-400/40 hover:bg-indigo-500/30"
                >
                    {editSaving === asset.id ? text('saving') : text('save_edits')}
                </button>
                <button
                    type="button"
                    onClick={() => resetEditDraft(asset)}
                    className="rounded-xl border border-white/10 px-3 py-2 text-xs text-indigo-200/70 hover:border-indigo-400/40 hover:text-white"
                >
                    {text('cancel_edit')}
                </button>
            </div>
        </div>
    );
};
