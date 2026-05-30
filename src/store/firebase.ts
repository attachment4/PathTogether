// DEPRECATED: используйте src/firebase.ts.
// Этот файл — re-export, чтобы старые импорты из `./firebase` внутри `src/store`
// продолжили работать и не было двух разных init'ов Firebase.
export { db, auth } from '../firebase';
