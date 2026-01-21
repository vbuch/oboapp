import { Suspense } from "react";
import HomeContent from "@/components/HomeContent";
import SplashScreen from "@/components/SplashScreen";

export default function Home() {
  return (
    <Suspense fallback={<SplashScreen />}>
      <HomeContent />
    </Suspense>
  );
}
