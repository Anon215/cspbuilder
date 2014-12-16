#!/usr/bin/env python
# -*- coding: utf-8 -*-
import datetime
import re
import random

from netaddr import IPAddress, IPNetwork


__author__ = 'Paweł Krawczyk'


def str_in_policy(p, t, s):
    """
    Find string s in statement of type t in CSP policy p.
    :param p: full policy string
    :param t: policy type to search in, such as script-src, style-src etc
    :param s: string to find
    :return: True if found, False otherwise
    """
    for st in map(s.strip, p.split(';')):
        if st.startswith(t):
            if st.find(s):
                return True
    return False


def base_uri_match(a, b):
    """
    Compare origin of two URLs to check if they both come from the same origin.
    :param a: first URL
    :param b: second URL
    :return: True or False
    """
    r = re.match(r'^(https?://[^?#/]+)', a)
    if not r:
        return False
    a = r.group(1)

    r = re.match(r'^(https?://[^?#/]+)', b)
    if not r:
        return False
    b = r.group(1)

    return a == b


class DocIdGen(object):
    def __init__(self):
        self.epoch = datetime.datetime.utcfromtimestamp(0)

    def gen_id(self, owner_id):
        recv_time = (datetime.datetime.now() - self.epoch).total_seconds()
        return '{}{}{}'.format(owner_id, str(recv_time).replace('.', ''), random.randint(0, 1000))


class ClientResolver(object):
    def __init__(self, ips=None):
        # taken from https://www.cloudflare.com/ips, last updated on 16 Dec 2014
        if ips:
            self.cf_ips = list(map(IPNetwork, ips.split()))
        else:
            self.cf_ips = [
                IPNetwork('199.27.128.0/21'), IPNetwork('173.245.48.0/20'), IPNetwork('103.21.244.0/22'),
                IPNetwork('103.22.200.0/22'), IPNetwork('103.31.4.0/22'), IPNetwork('141.101.64.0/18'),
                IPNetwork('108.162.192.0/18'), IPNetwork('190.93.240.0/20'), IPNetwork('188.114.96.0/20'),
                IPNetwork('197.234.240.0/22'), IPNetwork('198.41.128.0/17'), IPNetwork('162.158.0.0/15'),
                IPNetwork('104.16.0.0/12'), IPNetwork('2400:cb00::/32'), IPNetwork('2606:4700::/32'),
                IPNetwork('2803:f800::/32'), IPNetwork('2405:b500::/32'), IPNetwork('2405:8100::/32'),
            ]

    def get_ip(self, req):
        """
        Obtain real client IP address, either directly or from CloudFlare headers.
        :param req:
        :return:
        """
        client_ip = req.environ.get('REMOTE_ADDR')
        if not client_ip:
            return None
        # parse into IP
        client_ip = IPAddress(client_ip)
        for net in self.cf_ips:
            if client_ip in net:
                # this is CloudFlare network, try to extract real IP
                cf_ip = req.headers.get('CF-Connecting-IP')
                if cf_ip:
                    return cf_ip
                else:
                    print(
                        'get_client_ip request came from CloudFlare IP {} but did not contain CF-Connecting-IP'.format(
                            client_ip))
        # return original IP otherwise
        return str(client_ip)

    def get_geo(self, req):
        """
        Get client geolocation country from Nginx or CloudFlare variable.
        :return: country code such as PL
        """
        ret = req.headers.get('CF-IPCountry')
        if ret:
            return ret
        ret = req.environ.get('GEOIP_COUNTRY')
        if ret:
            return ret
        return None
