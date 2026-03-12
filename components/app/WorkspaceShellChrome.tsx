import React from 'react';
import { AlertTriangle, Pencil, Plus, Trash2 } from 'lucide-react';
import type { TranslationKey } from '../../i18n';
import type { Brand, BrandReference } from '../../types/zefgen';
import type { BrandAppSummary } from '../../hooks/use-brand-app-summaries';
import type { AppPage } from '../../utils/routes';
import { ConfirmIconButton } from './ConfirmIconButton';

type WorkspaceShellChromeProps = {
    activePage: AppPage;
    actionError: string | null;
    brandAppSummaryByBrandId: Record<string, BrandAppSummary>;
    brandFormLoading: boolean;
    brandFormOpen: boolean;
    brandIconReference: BrandReference | null;
    brandIconUploading: boolean;
    brandRefUrls: Record<string, string>;
    brandsCount: number;
    dataError: string | null;
    dataLoading: boolean;
    editingBrandId: string | null;
    isClaimingEditLock: boolean;
    isCurrentBrandReadOnly: boolean;
    isNoBrandMode: boolean;
    onBrandIconUpload: React.ChangeEventHandler<HTMLInputElement>;
    onCloseBrandForm: () => void;
    onCreateBrand: () => void;
    onDeleteBrandIcon: () => void;
    onEditBrand: () => void;
    onOpenLightbox: (url: string, title: string) => void;
    onRetry: () => void;
    onSaveBrand: () => void | Promise<void>;
    onStartEditing: () => void;
    selectedBrand: Brand | null;
    stickyHeaderRef: React.RefObject<HTMLDivElement | null>;
    text: (key: TranslationKey) => string;
};

export function WorkspaceShellChrome({
    activePage,
    actionError,
    brandAppSummaryByBrandId,
    brandFormLoading,
    brandFormOpen,
    brandIconReference,
    brandIconUploading,
    brandRefUrls,
    brandsCount,
    dataError,
    dataLoading,
    editingBrandId,
    isClaimingEditLock,
    isCurrentBrandReadOnly,
    isNoBrandMode,
    onBrandIconUpload,
    onCloseBrandForm,
    onCreateBrand,
    onDeleteBrandIcon,
    onEditBrand,
    onOpenLightbox,
    onRetry,
    onSaveBrand,
    onStartEditing,
    selectedBrand,
    stickyHeaderRef,
    text,
}: WorkspaceShellChromeProps) {
    const isWorkspacePage = activePage === 'workspace';
    const isBrandEditing = Boolean(
        selectedBrand &&
            !isNoBrandMode &&
            brandFormOpen &&
            editingBrandId === selectedBrand.id
    );
    const selectedBrandSummary = selectedBrand ? brandAppSummaryByBrandId[selectedBrand.id] : null;
    const brandIconUrl = brandIconReference ? brandRefUrls[brandIconReference.id] || null : null;
    const hasBrandIcon = Boolean(!isNoBrandMode && brandIconUrl);
    const brandSummaryRows = [
        {
            key: 'active',
            label: text('active_apps'),
            count: selectedBrandSummary?.active ?? 0,
            dotClassName: 'bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.35)]',
        },
        {
            key: 'ready',
            label: text('ready'),
            count: selectedBrandSummary?.yellow ?? 0,
            dotClassName: 'bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.30)]',
        },
        {
            key: 'banned',
            label: text('banned_apps'),
            count: selectedBrandSummary?.red ?? 0,
            dotClassName: 'bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.30)]',
        },
    ] as const;

    const handleOpenBrandIconPreview = (event?: React.MouseEvent<HTMLImageElement>) => {
        event?.preventDefault();
        event?.stopPropagation();
        if (!brandIconUrl) return;
        onOpenLightbox(brandIconUrl, text('icon_reference'));
    };

    const renderBrandIcon = () => {
        if (isNoBrandMode) {
            return (
                <div className="flex h-16 w-16 aspect-square items-center justify-center overflow-hidden rounded-[18px] border border-indigo-400/20 bg-slate-800/35 text-xs text-indigo-200/50">
                    <span className="text-[10px] font-semibold tracking-[0.1em]">
                        {text('no_brand_short')}
                    </span>
                </div>
            );
        }

        const containerClassName = `flex h-16 w-16 aspect-square items-center justify-center overflow-hidden rounded-[18px] ${
            isBrandEditing
                ? `text-xs text-indigo-200/70 hover:border-indigo-400/50 ${
                      isCurrentBrandReadOnly ? 'pointer-events-none cursor-not-allowed opacity-70' : 'cursor-pointer'
                  } ${
                      hasBrandIcon ? 'border border-transparent bg-slate-900/20' : 'border border-indigo-400/30 bg-slate-800/35'
                  }`
                : `text-xs text-indigo-200/60 ${
                      hasBrandIcon ? 'border border-transparent bg-slate-900/20' : 'border border-indigo-400/20 bg-slate-800/35'
                  }`
        }`;

        const iconContent = brandIconUrl ? (
            <img
                src={brandIconUrl}
                alt={text('icon_reference')}
                className="h-full w-full cursor-zoom-in rounded-[18px] object-cover"
                onClick={handleOpenBrandIconPreview}
            />
        ) : (
            <Plus size={16} />
        );

        if (isBrandEditing) {
            return (
                <label
                    htmlFor="brand-icon-upload"
                    className={containerClassName}
                    title={brandIconReference ? text('replace_icon') : text('upload_icon')}
                >
                    {iconContent}
                </label>
            );
        }

        return <div className={containerClassName}>{iconContent}</div>;
    };

    return (
        <>
            {isWorkspacePage ? (
                <div
                    ref={stickyHeaderRef}
                    className="sticky top-0 z-30 -mx-6 flex flex-wrap items-center justify-between gap-4 border-b border-indigo-900/30 bg-slate-950/90 px-6 py-4 backdrop-blur lg:-mx-10 lg:px-10"
                >
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex flex-col items-center gap-2">
                            {renderBrandIcon()}
                            {!isNoBrandMode && isBrandEditing && (
                                <div className="flex items-center gap-2">
                                    <label
                                        htmlFor="brand-icon-upload"
                                        className={`inline-flex items-center gap-1 rounded-full border border-indigo-400/30 px-2.5 py-1 text-[10px] font-semibold text-indigo-100 hover:bg-indigo-400/10 ${
                                            isCurrentBrandReadOnly
                                                ? 'pointer-events-none cursor-not-allowed opacity-60'
                                                : 'cursor-pointer'
                                        }`}
                                    >
                                        {brandIconUploading
                                            ? text('uploading')
                                            : brandIconReference
                                                ? text('replace_icon')
                                                : text('upload_icon')}
                                    </label>
                                    {brandIconReference && (
                                        <ConfirmIconButton
                                            label={text('delete')}
                                            question={`${text('confirm_delete')} ${text('confirm_delete_hint')}`}
                                            confirmLabel={text('delete')}
                                            cancelLabel={text('cancel')}
                                            disabled={isCurrentBrandReadOnly}
                                            onConfirm={onDeleteBrandIcon}
                                        >
                                            <span className="inline-flex items-center justify-center rounded-full border border-white/10 p-2 text-indigo-200/70 hover:border-indigo-400/40 hover:text-white">
                                                <Trash2 size={12} />
                                            </span>
                                        </ConfirmIconButton>
                                    )}
                                </div>
                            )}
                            {!isNoBrandMode && (
                                <input
                                    id="brand-icon-upload"
                                    type="file"
                                    accept="image/png,image/jpeg"
                                    className="hidden"
                                    onChange={onBrandIconUpload}
                                    disabled={!selectedBrand || !isBrandEditing || brandIconUploading || isCurrentBrandReadOnly}
                                />
                            )}
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold tracking-[0.12em] text-indigo-200/70">{text('brand_label')}</p>
                            <h2 className="text-3xl font-semibold text-white">
                                {selectedBrand ? selectedBrand.name : text('no_brand_selected')}
                            </h2>
                            <p className="text-sm text-indigo-200/60">
                                {selectedBrand ? `/${selectedBrand.slug}` : text('create_or_select_brand')}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {selectedBrand ? (
                            <div className="hidden shrink-0 flex-col gap-1 rounded-2xl border border-white/10 bg-slate-950/20 px-3 py-2 lg:flex">
                                {brandSummaryRows.map((row) => (
                                    <div key={row.key} className="flex items-center justify-between gap-4 text-[11px] leading-none">
                                        <span className="inline-flex items-center gap-2 whitespace-nowrap text-indigo-200/80">
                                            <span className={`h-1.5 w-1.5 rounded-full ${row.dotClassName}`} />
                                            {row.label}
                                        </span>
                                        <span className="tabular-nums font-semibold text-white/90">{row.count}</span>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                        {selectedBrand && !isNoBrandMode ? (
                            isBrandEditing ? (
                                <>
                                    <button
                                        onClick={() => {
                                            void onSaveBrand();
                                        }}
                                        disabled={brandFormLoading || isCurrentBrandReadOnly}
                                        className={`inline-flex items-center gap-2 rounded-full border border-indigo-400/40 px-4 py-2 text-xs font-semibold text-indigo-100 hover:bg-indigo-400/10 ${
                                            brandFormLoading ? 'pointer-events-none opacity-70' : ''
                                        }`}
                                    >
                                        <Pencil size={14} />
                                        {brandFormLoading ? text('saving') : text('save')}
                                    </button>
                                    <button
                                        onClick={onCloseBrandForm}
                                        disabled={brandFormLoading}
                                        className={`inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-indigo-200/80 hover:border-indigo-400/30 hover:text-white ${
                                            brandFormLoading ? 'pointer-events-none opacity-70' : ''
                                        }`}
                                    >
                                        {text('cancel')}
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={onEditBrand}
                                    disabled={isCurrentBrandReadOnly}
                                    className="inline-flex items-center gap-2 rounded-full border border-indigo-400/40 px-4 py-2 text-xs font-semibold text-indigo-100 hover:bg-indigo-400/10 disabled:opacity-60"
                                >
                                    <Pencil size={14} />
                                    {text('edit_brand')}
                                </button>
                            )
                        ) : null}
                    </div>
                </div>
            ) : null}

            {dataError ? (
                <div
                    data-testid="app-shell-data-error"
                    role="alert"
                    className="flex items-start gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200"
                >
                    <AlertTriangle size={18} />
                    <div>
                        <p className="font-semibold">{text('data_load_error_title')}</p>
                        <p className="text-xs text-rose-200/70">{dataError}</p>
                        <button
                            onClick={onRetry}
                            className="mt-3 rounded-full border border-rose-300/40 px-3 py-1 text-xs font-semibold text-rose-100"
                        >
                            {text('retry')}
                        </button>
                    </div>
                </div>
            ) : null}

            {actionError ? (
                <div
                    data-testid="app-shell-action-error"
                    role="alert"
                    className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100"
                >
                    <AlertTriangle size={18} />
                    <div>
                        <p className="font-semibold">{text('action_error_title')}</p>
                        <p className="text-xs text-amber-100/70">{actionError}</p>
                    </div>
                </div>
            ) : null}

            {isWorkspacePage && selectedBrand && isCurrentBrandReadOnly ? (
                <div className="flex items-start justify-between gap-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
                    <div className="flex items-start gap-3">
                        <AlertTriangle size={18} />
                        <div>
                            <p className="font-semibold">{text('action_error_title')}</p>
                            <p className="text-xs text-amber-100/70">{text('brand_under_work_readonly')}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onStartEditing}
                        disabled={isClaimingEditLock}
                        className="inline-flex shrink-0 items-center gap-2 rounded-full border border-amber-300/35 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-50 hover:bg-amber-500/20 disabled:opacity-60"
                    >
                        {isClaimingEditLock ? text('saving') : text('brand_start_editing')}
                    </button>
                </div>
            ) : null}

            {isWorkspacePage && !dataLoading && brandsCount === 0 ? (
                <div className="rounded-[32px] bg-slate-800/45 p-10 text-center shadow-[0_20px_50px_-40px_rgba(15,23,42,0.8)] ring-1 ring-white/5">
                    <p className="text-lg font-semibold text-white">{text('create_first_brand')}</p>
                    <p className="mt-2 text-sm text-indigo-200/70">{text('brands_hold_references')}</p>
                    <button
                        onClick={onCreateBrand}
                        className="mt-5 inline-flex items-center gap-2 rounded-full border border-indigo-400/40 bg-indigo-400/20 px-5 py-2 text-sm font-semibold text-indigo-100"
                    >
                        <Plus size={16} />
                        {text('new_brand')}
                    </button>
                </div>
            ) : null}
        </>
    );
}
