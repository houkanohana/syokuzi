import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  FileText,
  HeartHandshake,
  Lock,
  ShieldAlert,
  X,
} from 'lucide-react';
import type { LegalTab } from '../types';

interface DisclaimerModalProps {
  isOpen: boolean;
  isReviewMode?: boolean;
  initialTab?: LegalTab;
  onAccept: () => void;
  onClose?: () => void;
}

export function DisclaimerModal({
  isOpen,
  isReviewMode = false,
  initialTab = 'disclaimer',
  onAccept,
  onClose,
}: DisclaimerModalProps) {
  const [checked, setChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const tabs: { id: LegalTab; label: string; icon: typeof ShieldAlert }[] = [
    { id: 'disclaimer', label: '医療免責事項', icon: ShieldAlert },
    { id: 'terms', label: '利用規約', icon: FileText },
    { id: 'privacy', label: 'プライバシー', icon: Lock },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
    >
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
              <HeartHandshake className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wide text-teal-700">
                おうち献立ケア
              </p>
              <h2 id="disclaimer-title" className="text-lg font-bold text-slate-900">
                {isReviewMode
                  ? '免責事項・利用規約・プライバシー'
                  : 'ご利用前の大切な確認'}
              </h2>
            </div>
          </div>
          {isReviewMode && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="閉じる"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* 3タブ切替 */}
        <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-2xl bg-slate-100 p-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold transition ${
                  active
                    ? 'bg-white text-teal-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* タブ1: 医療免責事項 */}
        {activeTab === 'disclaimer' && (
          <div className="mt-4 space-y-3.5">
            <div className="rounded-2xl border border-amber-200 bg-amber-50/85 p-3.5">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <p className="text-xs font-semibold leading-relaxed text-amber-950">
                  本アプリは日々の食事管理・献立検討・体調記録を支援する<strong>参考ツール</strong>であり、医師法・保健師助産師看護師法に基づく医療行為、診断、治療、または個別の栄養指導の代替となるものではありません。
                </p>
              </div>
            </div>

            <ul className="space-y-2.5 text-xs leading-relaxed text-slate-700">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                <span>
                  <strong>主治医・管理栄養士の指示を最優先してください：</strong>
                  腎不全・心不全・糖尿病・肝硬変・抗がん剤治療中など、検査値や病期によって適切な制限値は異なります。設定画面の「栄養目安の上書き」「主治医指示値ロック機能」をご活用ください。
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                <span>
                  <strong>栄養価・調理形態は推定目安です：</strong>
                  実際の栄養価は食材の産地・製品・調味料加減により変動します。食物アレルギー、服薬との相互作用（グレープフルーツ・納豆等）、嚥下機能（飲み込みやすさ）は必ずご自身・ご家族・医療専門職でご確認ください。
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                <span>
                  <strong>急な体調変化時は医療機関へ：</strong>
                  急激な体重増加、強いむくみ、息苦しさ、高熱、脱水症状などがある場合は、本アプリに頼らず速やかに主治医・訪問看護ステーションへご相談ください。
                </span>
              </li>
            </ul>
          </div>
        )}

        {/* タブ2: 利用規約 */}
        {activeTab === 'terms' && (
          <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-700">
            <h3 className="font-bold text-slate-900">利用規約（概要）</h3>
            <p>
              1. <strong>目的と適用範囲</strong>：本規約は、「おうち献立ケア」（以下「本アプリ」）のご利用条件を定めるものです。利用者は本規約および医療免責事項に同意のうえ本アプリを利用するものとします。
            </p>
            <p>
              2. <strong>外部サービス連携</strong>：YouTube動画検索・埋め込み再生、および利用者が任意で設定したGoogle Gemini API連携（献立生成・チラシ画像解析）の利用にあたっては、各提供元の利用規約およびAPI利用料金条件に従うものとします。
            </p>
            <p>
              3. <strong>データの管理責任</strong>：本アプリのデータは端末ブラウザ内に保存されます。端末故障・キャッシュ消去に備え、設定画面の「JSONバックアップ書き出し」機能による定期保存を推奨します。
            </p>
            <p>
              4. <strong>免責</strong>：本アプリが提案する献立・栄養推定値・チラシ読み取り結果の正確性・完全性を保証するものではなく、利用により生じた損害について運営者は法令上の責任を除き一切の責任を負いません。
            </p>
          </div>
        )}

        {/* タブ3: プライバシーポリシー */}
        {activeTab === 'privacy' && (
          <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-700">
            <h3 className="font-bold text-slate-900">プライバシーポリシー</h3>
            <p>
              1. <strong>ローカル保存の原則</strong>：入力された疾患モード、栄養目安、自宅在庫、食事記録、体重・血圧・体調ログ、チラシ情報、Gemini APIキーは、すべてお使いの端末のブラウザ内（localStorage）にのみ保存され、アプリ運営者のサーバーへ自動送信・収集されることはありません。
            </p>
            <p>
              2. <strong>AI機能利用時の外部送信</strong>：利用者がご自身のGemini APIキーを入力し「AI献立生成」または「チラシ画像AI読み取り」を実行した場合に限り、必要な範囲の条件テキストまたはチラシ画像がGoogle Gemini APIへ直接送信されます。
            </p>
            <p>
              3. <strong>データの削除とバックアップ</strong>：バックアップ機能で書き出したJSONファイルはご自身の責任で管理してください（医療情報・APIキーを含むため、共有時の取り扱いにご注意ください）。ブラウザのサイトデータ削除により全データを即時消去できます。
            </p>
          </div>
        )}

        {isReviewMode ? (
          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-2xl bg-teal-700 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800"
          >
            確認しました（閉じる）
          </button>
        ) : (
          <div className="mt-5 space-y-3.5 border-t border-slate-100 pt-4">
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 transition hover:border-teal-300">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="mt-0.5 h-5 w-5 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
              />
              <span className="text-xs font-semibold leading-snug text-slate-800">
                医療免責事項・利用規約・プライバシーポリシーを理解し、食事管理の参考ツールとして利用することに同意します。
              </span>
            </label>

            <button
              type="button"
              disabled={!checked}
              onClick={onAccept}
              className="w-full rounded-2xl bg-teal-700 py-3.5 text-sm font-bold text-white shadow-md shadow-teal-700/20 transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              同意してはじめる
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
