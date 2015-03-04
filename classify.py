#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Subscribes to CouchDB feed returning any new unclassified documents and classify them in real time.
Use KnownList object that will update itself automatically on periodic basis.
"""
import pickle
import sys
import signal

from api.known import KnownList
import os
import pycouchdb


__author__ = 'Paweł Krawczyk'

database = pycouchdb.Server().database('csp')
DEBUG = False

# This object is used to classify new reports
# and periodically refreshes the KnownList
kl = KnownList(database)

from pycouchdb.feedreader import BaseFeedReader

last_seq = 0
SEQ_FILE = os.path.join(os.getcwd(), 'seq_classify.txt')


def sighandler(signum, frame):
    print('Killed by signal', signum, 'saving seq', last_seq)
    with open(SEQ_FILE, 'wb') as f:
        pickle.dump(last_seq, f)
    sys.exit(0)


signal.signal(signal.SIGTERM, sighandler)
signal.signal(signal.SIGINT, sighandler)

print('KNOWN LIST', len(kl.known_list), 'entries')


class Reader(BaseFeedReader):
    """
    Class for processing Known List changes.
    """

    def on_close(self):
        global last_seq
        with open(SEQ_FILE, 'wb') as f:
            pickle.dump(last_seq, f)

    def on_message(self, message):
        global DEBUG, last_seq

        if 'id' not in message:
            if DEBUG:
                print('*****************')
                print('message=', message)
                print('==> skip, no id')
            return

        if 'deleted' in message:
            if DEBUG:
                print('*****************')
                print('message=', message)
                print('==> skip, deleted')
            return

        doc_id = message['id']
        doc = self.db.get(doc_id)

        if 'csp-report' not in doc:
            if DEBUG:
                print('*****************')
                print('message=', message)
                print('==> skip, no csp-report')
            return

        owner_id = doc['owner_id']
        report = doc['csp-report']

        decision = kl.decision(owner_id, report)

        review = {'decision': decision['action'], 'method': __file__, 'rule': decision['rule']}

        doc['review'] = review

        if DEBUG:
            print('*****************')
            print('message=', message)
            print('==> decision={} ({})'.format(decision['action'], decision))

        try:
            self.db.save(doc, batch=True)
        except pycouchdb.exceptions.Conflict as e:
            print(e, doc)

# start the main loop of the Classifier
if __name__ == '__main__':

    if len(sys.argv) > 1 and sys.argv[1] == 'debug':
        DEBUG = True

    # read CouchDB change feed 'seq' number to avoid reading through
    # already processed changes in case of re-run
    try:
        with open(SEQ_FILE, 'rb') as ff:
            last_seq = pickle.load(ff)
    except IOError:
        seq = 0

    # subscribe to the changes feed in the database and
    # run callback on each new, unclassified message
    while True:
        try:
            database.changes_feed(Reader(), filter='csp/unclassified', since=last_seq)
        except ValueError:
            pass
