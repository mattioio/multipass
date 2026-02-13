import { AppLayout } from "./layout/AppLayout";
import { AppProviders } from "./providers/AppProviders";
import { AppRouter } from "./routing/AppRouter";
import { AppScreens } from "./screens/app/AppScreens";

export function App() {
  const isDevBuild = import.meta.env.DEV;

  return (
    <AppProviders>
      <AppRouter>
        <AppLayout isDevBuild={isDevBuild}>
          <AppScreens isDevBuild={isDevBuild} />
        </AppLayout>
      </AppRouter>
    </AppProviders>
  );
}
