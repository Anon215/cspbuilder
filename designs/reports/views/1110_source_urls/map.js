/**
 * Created by Paweł Krawczyk on 25/04/15.
 */
(function (doc) {
    if (doc['owner_id'] && doc['csp-report'] && doc['csp-report']['blocked-uri']) {
        if (!doc['review'] || (doc['review'] && doc['review']['decision'] === 'unknown')) {
            blocked_uri = doc['csp-report']['blocked-uri'];
            if (/^data:/.test(blocked_uri)) {
                // truncate the BASE64 encoded data from URI
                blocked_uri = blocked_uri.split(',')[0];
            }
            if (/^https?/.test(blocked_uri)) {
                // truncate URI to exclude params after ? or #
                blocked_uri = blocked_uri.match(/^(https?:\/\/[^?#]+)/)[1];
                blocked_uri = blocked_uri.split('/').slice(0, 3).join('/');
            }

            emit(blocked_uri, 1);

        }
    }
});