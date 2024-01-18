import { useEffect, useState } from 'react';

export default function useLocalStorage(key:string, initialValue:any) {

    const [storedValue, setStoredValue] = useState(initialValue)
    useEffect(() => {
        window.chatBot.electronStoreGet(key).then(setStoredValue)
    }, [key]);
    // Return a wrapped version of useState's setter function that ...
    // ... persists the new value to localStorage.
    const setValue = (value:any) => {
        try {
            // Allow value to be a function so we have same API as useState
            const valueToStore =
                value instanceof Function ? value(storedValue) : value;
            // Save state
            setStoredValue(valueToStore);
            window.chatBot.electronStoreSet(key, value)
        } catch (error) {
            // A more advanced implementation would handle the error case
            console.log(error);
        }
    };
    return [storedValue, setValue];
}
