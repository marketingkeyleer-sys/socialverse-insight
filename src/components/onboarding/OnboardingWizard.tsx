import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { WelcomeStep } from "@/components/onboarding/WelcomeStep";
import { ConnectStep } from "@/components/onboarding/ConnectStep";
import { TourStep } from "@/components/onboarding/TourStep";
import { useProfile } from "@/hooks/useProfile";

const TOTAL_STEPS = 3;

export function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const { updateProfile } = useProfile();
  const navigate = useNavigate();

  const handleFinish = () => {
    updateProfile.mutate(
      { onboarding_completed: true },
      { onSuccess: () => navigate("/dashboard") },
    );
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
      <Progress value={(step / TOTAL_STEPS) * 100} className="mb-10" />
      {step === 1 && <WelcomeStep onNext={() => setStep(2)} />}
      {step === 2 && <ConnectStep onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && <TourStep onFinish={handleFinish} loading={updateProfile.isPending} />}
    </div>
  );
}
