import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { WelcomeStep } from "@/components/onboarding/WelcomeStep";
import { ConnectStep } from "@/components/onboarding/ConnectStep";
import { TourStep } from "@/components/onboarding/TourStep";
import { useProfile } from "@/hooks/useProfile";
import { BrandStep } from "@/components/onboarding/BrandStep";
import { useAuth } from "@/hooks/useAuth";
import { sessionChoice, saveSessionChoice, onboardingStep } from "@/lib/workspaceSession";

const TOTAL_STEPS = 4;

export function OnboardingWizard() {
  const { user } = useAuth();
  const stepKey = `socialverse:onboarding:${user?.id ?? ""}`;
  const [progress, setProgress] = useState({ owner: user?.id, step: onboardingStep(sessionChoice(stepKey)) });
  const step = progress.owner === user?.id ? progress.step : onboardingStep(sessionChoice(stepKey));
  const setStep = (next: number) => {
    saveSessionChoice(stepKey, String(next));
    setProgress({ owner: user?.id, step: next });
  };
  const { updateProfile } = useProfile();
  const navigate = useNavigate();

  const handleFinish = () => {
    updateProfile.mutate(
      { onboarding_completed: true },
      { onSuccess: () => { saveSessionChoice(stepKey, null); navigate("/dashboard"); } },
    );
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
      <Progress value={(step / TOTAL_STEPS) * 100} className="mb-10" />
      {step === 1 && <WelcomeStep onNext={() => setStep(2)} />}
      {step === 2 && <BrandStep onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && <ConnectStep onNext={() => setStep(4)} onBack={() => setStep(2)} />}
      {step === 4 && <TourStep onFinish={handleFinish} loading={updateProfile.isPending} />}
    </div>
  );
}
