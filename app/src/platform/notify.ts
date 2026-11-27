import { Alert } from 'react-native';

export function notify(title: string, message?: string) {
  Alert.alert(title, message);
}

export function confirm(title: string, message: string, okText = 'OK'): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: okText, style: 'destructive', onPress: () => resolve(true) },
    ])
  );
}
