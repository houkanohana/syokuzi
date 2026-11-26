import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertCircle,
  Camera,
  Check,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  Loader2,
  PackagePlus,
  Plus,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  Store,
  Tag,
  Trash2,
} from 'lucide-react';
import type { FlyerEntry, ShoppingItem, SuggestedMeal, UserProfile } from '../types';
import { extractFlyerDealsWithGeminiVision } from '../utils/geminiService';
import {
  createSampleFlyers,
  groupShoppingByStore,
  parseTextFlyerMemo,
} from '../utils/shoppingEngine';

interface ShoppingFlyerViewProps {
  profile: UserProfile;
  suggestedMeals: SuggestedMeal[];
  flyers: FlyerEntry[];
  shoppingItems: ShoppingItem[];
  onChangeFlyers: (next: FlyerEntry[]) => void;
  onChangeShoppingItems: (next: ShoppingItem[]) => void;
  onResyncFromMeals: () => void;
  onMoveCheckedToInventory: () => void;
  onOpenProfile: () => void;
}

export function ShoppingFlyerView({
  profile,
  suggestedMeals,
  flyers,
  shoppingItems,
  onChangeFlyers,
  onChangeShoppingItems,
  onResyncFromMeals,
  onMoveCheckedToInventory,
  onOpenProfile,
}: ShoppingFlyerViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [visionLoading, setVisionLoading] = useState(false);
  const [visionError, setVisionError] = useState<string | null>(null);
  const [visionSuccess, setVisionSuccess] = useState<string | null>(null);
  const [imageStoreHint, setImageStoreHint] = useState('');

  // テキスト/URL特売メモフォーム
  const [memoStoreName, setMemoStoreName] = useState('');
  const [memoUrl, setMemoUrl] = useState('');
  const [memoBody, setMemoBody] = useState('');

  // 手動買い物アイテム追加
  const [manualName, setManualName] = useState('');
  const [manualAmount, setManualAmount] = useState('');

  const storeGroups = groupShoppingByStore(shoppingItems);
  const checkedCount = shoppingItems.filter((i) => i.checked).length;
  const totalMissingInMeals = suggestedMeals.reduce(
    (sum, m) => sum + m.missingIngredients.length,
    0
  );

  const handleToggleCheck = (id: string) => {
    onChangeShoppingItems(
      shoppingItems.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const handleDeleteShoppingItem = (id: string) => {
    onChangeShoppingItems(shoppingItems.filter((item) => item.id !== id));
  };

  const handleAddManualShopping = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = manualName.trim();
    if (!trimmed) return;
    const newItem: ShoppingItem = {
      id: `manual-${Date.now()}`,
      name: trimmed,
      amount: manualAmount.trim() || '1つ',
      checked: false,
      isManual: true,
    };
    onChangeShoppingItems([...shoppingItems, newItem]);
    setManualName('');
    setManualAmount('');
  };

  const handleAddDemoShoppingItems = () => {
    const demoNames = [
      { name: '豚こま肉', amount: '200g' },
      { name: 'キャベツ', amount: '1/2玉' },
      { name: '生鮭切り身', amount: '2切れ' },
      { name: '減塩醤油', amount: '1本' },
      { name: '牛乳', amount: '1本' },
    ];
    const existing = new Set(shoppingItems.map((i) => i.name));
    const additions: ShoppingItem[] = demoNames
      .filter((d) => !existing.has(d.name))
      .map((d, idx) => ({
        id: `demo-shop-${Date.now()}-${idx}`,
        name: d.name,
        amount: d.amount,
        checked: false,
        isManual: true,
      }));
    if (additions.length > 0) {
      onChangeShoppingItems([...shoppingItems, ...additions]);
    }
  };

  const handleLoadSampleFlyers = () => {
    setVisionError(null);
    const samples = createSampleFlyers();
    const nonSamples = flyers.filter((f) => f.sourceType !== 'sample');
    onChangeFlyers([...samples, ...nonSamples]);
    setVisionSuccess(
      'サンプルチラシ（〇〇スーパー・△△ドラッグストアの計12商品）を読み取り、買い物リストをお店別に振り分けました。'
    );
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setVisionLoading(true);
    setVisionError(null);
    setVisionSuccess(null);

    try {
      const entry = await extractFlyerDealsWithGeminiVision(
        profile.geminiApiKey,
        file,
        imageStoreHint
      );
      onChangeFlyers([entry, ...flyers]);
      setImageStoreHint('');
      setVisionSuccess(
        `「${entry.storeName}」のチラシから ${entry.items.length} 品の特売情報を読み取りました。`
      );
    } catch (err) {
      setVisionError(
        err instanceof Error ? err.message : 'チラシ画像の解析に失敗しました。'
      );
    } finally {
      setVisionLoading(false);
    }
  };

  const handleAddTextFlyer = (e: FormEvent) => {
    e.preventDefault();
    if (!memoStoreName.trim() || !memoBody.trim()) return;
    const entry = parseTextFlyerMemo(memoStoreName, memoBody, memoUrl);
    onChangeFlyers([entry, ...flyers]);
    setMemoStoreName('');
    setMemoUrl('');
    setMemoBody('');
    setVisionSuccess(`「${entry.storeName}」の特売メモ（${entry.items.length}品）を登録しました。`);
  };

  const handleDeleteFlyer = (id: string) => {
    onChangeFlyers(flyers.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-5 pb-6">
      {/* 1. お店別チェック式買い物リスト */}
      <section className="rounded-3xl border border-slate-200/90 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-teal-700" />
            <div>
              <h2 className="text-base font-bold text-slate-900">お店別 買い物リスト</h2>
              <p className="text-[11px] text-slate-500">
                献立の不足食材（{totalMissingInMeals}品）とチラシ特売を自動照合
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onResyncFromMeals}
            className="inline-flex items-center gap-1 rounded-xl border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            献立と同期
          </button>
        </div>

        {/* 買い物リスト手動追加 */}
        <form onSubmit={handleAddManualShopping} className="mt-3 flex gap-2">
          <input
            type="text"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            placeholder="買うものを追加（例：生鮭、減塩醤油）"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none"
          />
          <input
            type="text"
            value={manualAmount}
            onChange={(e) => setManualAmount(e.target.value)}
            placeholder="数量"
            className="w-20 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none"
          />
          <button
            type="submit"
            disabled={!manualName.trim()}
            className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-teal-700 px-3 py-2 text-xs font-bold text-white hover:bg-teal-800 disabled:bg-slate-300"
          >
            <Plus className="h-3.5 w-3.5" />
            追加
          </button>
        </form>

        {/* 空状態のときのテスト支援 */}
        {shoppingItems.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4 text-center">
            <p className="text-xs font-bold text-slate-700">
              現在、買い足しが必要な食材はありません
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              上の入力欄から食材を追加するか、テスト食材を追加してお店別の振り分けを試せます。
            </p>
            <button
              type="button"
              onClick={handleAddDemoShoppingItems}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-teal-300 bg-white px-3 py-2 text-xs font-bold text-teal-800 hover:bg-teal-50"
            >
              <Plus className="h-3.5 w-3.5" />
              お試し買い物リストを追加（豚こま肉・キャベツ等）
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {storeGroups.map((group) => (
              <div
                key={group.storeKey}
                className={`overflow-hidden rounded-2xl border ${
                  group.isMatchedStore
                    ? 'border-teal-200 bg-teal-50/35'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <div
                  className={`flex items-center justify-between px-3.5 py-2.5 ${
                    group.isMatchedStore
                      ? 'bg-teal-700 text-white'
                      : 'bg-slate-200/80 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <Store className="h-4 w-4" />
                    <span>{group.heading}</span>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      group.isMatchedStore
                        ? 'bg-white/20 text-white'
                        : 'bg-white text-slate-700'
                    }`}
                  >
                    {group.items.length}品
                  </span>
                </div>

                <ul className="divide-y divide-slate-200/60 bg-white">
                  {group.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start justify-between gap-2 px-3 py-2.5"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleCheck(item.id)}
                        className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                            item.checked
                              ? 'border-teal-700 bg-teal-700 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {item.checked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`text-sm font-bold ${
                                item.checked
                                  ? 'text-slate-400 line-through'
                                  : 'text-slate-900'
                              }`}
                            >
                              {item.name}
                            </span>
                            <span className="text-xs font-semibold text-slate-500">
                              {item.amount}
                            </span>
                          </div>
                          {item.matchedPriceText && (
                            <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100/90 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                              <Tag className="h-3 w-3" />
                              特売: {item.matchedPriceText}
                              {item.matchedDealName ? `（${item.matchedDealName}）` : ''}
                            </div>
                          )}
                          {item.sourceMealTitle && (
                            <p className="mt-0.5 truncate text-[10px] text-slate-400">
                              献立：{item.sourceMealTitle}
                            </p>
                          )}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteShoppingItem(item.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        aria-label={`${item.name}を削除`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {checkedCount > 0 && (
              <button
                type="button"
                onClick={onMoveCheckedToInventory}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 py-3 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-800"
              >
                <PackagePlus className="h-4 w-4" />
                購入済みの {checkedCount}品 を自宅在庫へ追加してリストから消す
              </button>
            )}
          </div>
        )}
      </section>

      {/* 2. チラシ画像読み取り（Gemini Vision）＆サンプルテスト */}
      <section className="rounded-3xl border border-slate-200/90 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-teal-700" />
          <div>
            <h2 className="text-base font-bold text-slate-900">チラシ画像から特売を読み取る</h2>
            <p className="text-[11px] text-slate-500">
              スーパー・ドラッグストアのチラシ写真/スクショをAIが自動リスト化
            </p>
          </div>
        </div>

        <div className="mt-3 space-y-2.5">
          <input
            type="text"
            value={imageStoreHint}
            onChange={(e) => setImageStoreHint(e.target.value)}
            placeholder="店舗名の補足（任意：画像から読めない場合に使用）"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none"
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={visionLoading}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-xs font-bold text-white shadow-xs transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {visionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              {visionLoading ? 'Gemini Visionで解析中...' : 'チラシ画像をアップロード（AI読取）'}
            </button>

            <button
              type="button"
              onClick={handleLoadSampleFlyers}
              className="flex items-center justify-center gap-2 rounded-2xl border border-teal-300 bg-teal-50 px-4 py-3 text-xs font-bold text-teal-900 transition hover:bg-teal-100"
            >
              <Sparkles className="h-4 w-4 text-teal-700" />
              サンプルチラシ読み取りテスト
            </button>
          </div>

          {!profile.geminiApiKey.trim() && (
            <p className="text-[11px] text-slate-500">
              ※画像AI読み取りにはGemini APIキーが必要です（
              <button
                type="button"
                onClick={onOpenProfile}
                className="font-bold text-teal-700 underline"
              >
                設定画面で入力
              </button>
              ）。APIキーなしでも右の「サンプルチラシ読み取りテスト」で動作確認できます。
            </p>
          )}

          {visionSuccess && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-900">
              {visionSuccess}
            </div>
          )}

          {visionError && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <span>{visionError}</span>
            </div>
          )}
        </div>
      </section>

      {/* 3. 特売テキスト・URLメモ手動登録 */}
      <section className="rounded-3xl border border-slate-200/90 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-teal-700" />
          <h2 className="text-base font-bold text-slate-900">特売テキスト・URLメモを登録</h2>
        </div>

        <form onSubmit={handleAddTextFlyer} className="mt-3 space-y-2.5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={memoStoreName}
              onChange={(e) => setMemoStoreName(e.target.value)}
              placeholder="店舗名（例：〇〇スーパー）"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none"
            />
            <input
              type="url"
              value={memoUrl}
              onChange={(e) => setMemoUrl(e.target.value)}
              placeholder="チラシURL（任意：https://...）"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none"
            />
          </div>

          <textarea
            rows={3}
            value={memoBody}
            onChange={(e) => setMemoBody(e.target.value)}
            placeholder={`特売品を1行ずつ入力（例）\nキャベツ 1玉 128円\n鶏むね肉 100g 68円\n絹ごし豆腐 88円`}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none"
          />

          <button
            type="submit"
            disabled={!memoStoreName.trim() || !memoBody.trim()}
            className="w-full rounded-2xl bg-slate-800 py-2.5 text-xs font-bold text-white transition hover:bg-slate-900 disabled:bg-slate-300"
          >
            特売メモを登録して買い物リストに反映
          </button>
        </form>
      </section>

      {/* 4. 登録済みチラシ・特売一覧 */}
      <section className="space-y-2.5">
        <h3 className="px-1 text-xs font-bold text-slate-600">
          登録済みのチラシ・特売情報（{flyers.length}件）
        </h3>

        {flyers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-center text-xs text-slate-500">
            まだチラシ情報が登録されていません。「サンプルチラシ読み取りテスト」を試すと特売リストが表示されます。
          </div>
        ) : (
          flyers.map((flyer) => (
            <div
              key={flyer.id}
              className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-900">
                      {flyer.storeName}
                    </span>
                    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700">
                      {flyer.sourceType === 'image_ai'
                        ? 'AI画像読取'
                        : flyer.sourceType === 'sample'
                          ? 'サンプル'
                          : 'テキストメモ'}
                    </span>
                  </div>
                  {flyer.memoOrUrl && (
                    <div className="mt-1 text-[11px] text-slate-500">
                      {flyer.memoOrUrl.startsWith('http') ? (
                        <a
                          href={flyer.memoOrUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-teal-700 underline"
                        >
                          <LinkIcon className="h-3 w-3" />
                          チラシURLを開く
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span>{flyer.memoOrUrl}</span>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteFlyer(flyer.id)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label={`${flyer.storeName}のチラシを削除`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {flyer.items.map((deal) => (
                  <span
                    key={deal.id}
                    className="inline-flex items-center gap-1 rounded-xl border border-amber-200/80 bg-amber-50/70 px-2.5 py-1 text-[11px] text-slate-800"
                  >
                    <span className="font-semibold">{deal.name}</span>
                    <span className="font-bold text-amber-800">{deal.priceText}</span>
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
