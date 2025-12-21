import { AppProvider, useApp } from './context/AppContext';
import { LoginScreen } from './screens/LoginScreen';
import { SignupScreen } from './screens/SignupScreen';
import { HomeScreen } from './screens/HomeScreen';
import { NewProjectScreen } from './screens/NewProjectScreen';
import { MeasurementLocationsScreen } from './screens/MeasurementLocationsScreen';
import { LocationGroupNameScreen } from './screens/LocationGroupNameScreen';
import { LocationCountScreen } from './screens/LocationCountScreen';
import { LocationDetailScreen } from './screens/LocationDetailScreen';
import { NewLocationScreen } from './screens/NewLocationScreen';
import { ShootingScreen } from './screens/ShootingScreen';
import { OCRConfirmScreen } from './screens/OCRConfirmScreen';
import { ResultsScreen } from './screens/ResultsScreen';

function AppContent() {
  const { currentScreen, loading } = useApp();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-600">読み込み中...</p>
      </div>
    );
  }

  switch (currentScreen) {
    case 'login':
      return <LoginScreen />;
    case 'signup':
      return <SignupScreen />;
    case 'home':
      return <HomeScreen />;
    case 'new-project':
      return <NewProjectScreen />;
    case 'measurement-locations':
      return <MeasurementLocationsScreen />;
    case 'location-group-name':
      return <LocationGroupNameScreen />;
    case 'location-count':
      return <LocationCountScreen />;
    case 'location-detail':
      return <LocationDetailScreen />;
    case 'new-location':
      return <NewLocationScreen />;
    case 'shooting':
      return <ShootingScreen />;
    case 'ocr-confirm':
      return <OCRConfirmScreen />;
    case 'results':
      return <ResultsScreen />;
    default:
      return <HomeScreen />;
  }
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
