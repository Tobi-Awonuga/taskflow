// TODO: Implement reactive state management (e.g. simple pub/sub or signals)

let state = {
  user: null,       // currently logged-in user
  tasks: [],        // cached task list
  departments: [],  // cached department list
};

const listeners = [];

export function getState() {
  return state;
}

export function setState(partial) {
  state = { ...state, ...partial };
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.push(fn);
  return () => listeners.splice(listeners.indexOf(fn), 1); // unsubscribe
}
