import { Redirect } from 'expo-router';
import { useAuth } from '../stores/auth';
import { Loading } from '../components/ui';
export default function Index() {
  const { ready, session } = useAuth();
  return ready ? <Redirect href={session ? '/dashboard' : '/login'} /> : <Loading />;
}
