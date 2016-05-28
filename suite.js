import test from 'ava';
import {t, f} from './jstest';


f('app', () => {
  return {app: 'i am an app'};
});


function db(request) {
  const {app} = request.fixtures;
  request.addFinalizer(() => {
    console.log('running the finalizer');
  })
  return {db: {app: app}};
}
db = f(db)


test('fake test', t((request, t) => {
  const {db, app} = request.fixtures;
  t.is(1, 1);
}));


test.only('async test', t(async (request, t) => {
  const {db} = await request.get('db', 'app');
  t.is(db, 1);
}));
