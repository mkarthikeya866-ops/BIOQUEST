import React, { useState } from 'react';
import { KeyRound, ShieldCheck, Cpu, RotateCcw, Compass, Info } from 'lucide-react';
import { VAULTS } from '../data/vaultData';
import { VaultId } from '../types/game';

interface CompletionRewardModalProps {
  collectedKeys: VaultId[];
  onExploreRestored: () => void;
  onReplayIntro: () => void;
  onResetProgress: () => void;
}

export const CompletionRewardModal: React.FC<CompletionRewardModalProps> = ({
  collectedKeys,
  onExploreRestored,
  onReplayIntro,
  onResetProgress,
}) => {
  const [showIntegrationSpec, setShowIntegrationSpec] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 overflow-y-auto">
      <div className="max-w-3xl w-full bg-[#080f1e] border border-emerald-500/50 rounded-xl overflow-hidden shadow-2xl my-auto">
        {/* Top Banner */}
        <div className="px-7 py-6 bg-[#071c1b] border-b border-emerald-500/35 text-center">
          <p className="font-mono-data text-xs tracking-[0.2em] text-emerald-400 mb-2">
            LOCKDOWN LIFTED · FACILITY POWER RESTORED
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-white">
            BIOQUEST MISSION COMPLETE
          </h2>
          <p className="text-sm text-emerald-100/85 mt-2 max-w-xl mx-auto">
            All five authentication keys verified. Corrupted pipeline job BQ-409 has been purged and legitimate candidate BQ-714 is queued for wet-lab EGFR assay validation.
          </p>
        </div>

        <div className="p-6 md:p-7 space-y-6">
          {/* Five Collected Keys Row */}
          <div>
            <p className="text-xs font-mono-data text-slate-400 mb-3">
              RECOVERED AUTHENTICATION KEYS ({collectedKeys.length} / 5)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {VAULTS.map((v) => (
                <div
                  key={v.id}
                  className="bg-[#0b1726] border border-emerald-500/45 rounded-lg p-3 text-center"
                >
                  <KeyRound className="w-5 h-5 text-emerald-400 mx-auto mb-1.5" />
                  <p className="font-mono-data text-xs font-semibold text-emerald-300">
                    KEY 0{v.id}
                  </p>
                  <p className="text-[11px] text-slate-300 mt-0.5 leading-tight">{v.title}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Final NEXUS Dialogue */}
          <div className="bg-cyan-950/35 border border-cyan-500/35 rounded-lg p-4">
            <div className="flex items-center gap-2 text-xs font-mono-data text-cyan-400 mb-1.5">
              <Cpu className="w-4 h-4" />
              <span>NEXUS FINAL TRANSMISSION</span>
            </div>
            <p className="text-sm text-cyan-50 leading-relaxed">
              &ldquo;Outstanding work, Researcher. You uncovered why the Blackout Protocol engaged—protecting scientific integrity against malformed SMILES inputs, ignored physicochemical flags, and exaggerated AI claims. Because you completed all five research vaults, your account is eligible for our Bioactive Molecule Prediction Platform educational discount once verified by a secure server.&rdquo;
            </p>
          </div>

          {/* Subscription Discount Eligibility (Honest DEMO REWARD — No Fake Coupon) */}
          <div className="bg-[#0b1324] border border-amber-500/45 rounded-lg p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-amber-300">
                <ShieldCheck className="w-5 h-5" />
                <h3 className="font-display text-lg font-bold text-white">
                  Subscription Discount Eligibility
                </h3>
              </div>
              <span className="font-mono-data text-xs font-semibold text-amber-300">
                DEMO REWARD · BACKEND VERIFICATION REQUIRED
              </span>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              This browser preview stores your 5-key completion state in <code className="font-mono-data text-cyan-300">localStorage</code> for demonstration only. Because client-side storage cannot be trusted as proof for billing discounts, no live coupon code is fabricated here. When connected to the production BioQuest platform backend, completing all five vaults issues a server-verified subscription discount token.
            </p>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowIntegrationSpec((prev) => !prev)}
                className="flex items-center gap-1.5 text-xs font-mono-data text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
              >
                <Info className="w-3.5 h-3.5" />
                <span>
                  {showIntegrationSpec
                    ? 'Hide Backend Verification Interface Preview'
                    : 'View Backend Verification Interface Preview'}
                </span>
              </button>

              {showIntegrationSpec && (
                <div className="mt-3 bg-[#060b16] border border-slate-800 rounded p-3.5 font-mono-data text-xs text-slate-300 overflow-x-auto">
                  <pre>{JSON.stringify(
                    {
                      rewardMode: 'DEMO_PREVIEW_NO_BACKEND_CONNECTED',
                      eligibleTier: 'Bioactive Molecule Prediction Platform — Educational Discount',
                      completedVaultIds: collectedKeys,
                      verificationNote:
                        'Connect authenticated server-side challenge verification to issue signed subscription coupons.',
                    },
                    null,
                    2
                  )}</pre>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onReplayIntro}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-700 hover:border-slate-500 rounded transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Replay Intro</span>
              </button>
              <button
                type="button"
                onClick={onResetProgress}
                className="text-xs text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
              >
                Reset Progress
              </button>
            </div>

            <button
              type="button"
              onClick={onExploreRestored}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded transition-colors cursor-pointer"
            >
              <Compass className="w-4 h-4" />
              <span>Explore the Modern World</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
