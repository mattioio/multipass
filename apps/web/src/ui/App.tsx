import { AppLayout } from "./layout/AppLayout";
import { AppProviders } from "./providers/AppProviders";
import { AppRouter } from "./routing/AppRouter";
import { AppScreens } from "./screens/app/AppScreens";

export function App() {
  return (
    <AppProviders>
      <AppRouter>
        <AppLayout>
          <AppScreens />
        </AppLayout>
      </AppRouter>
    </AppProviders>
  );
}
