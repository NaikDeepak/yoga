// npm run db:status:prod — read-only: which migrations production has, and a few row counts.
import { fail, printStatus, prodStatus } from './common';

prodStatus().then(printStatus).catch((e) => fail(`Could not read production: ${e.code ?? ''} ${e.message}`));
