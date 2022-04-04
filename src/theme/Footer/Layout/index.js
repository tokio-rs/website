/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';
import clsx from 'clsx';
export default function FooterLayout({ style, links, logo, copyright }) {
  return (
    <footer
      className={clsx('footer', {
        'footer--dark': style === 'dark',
      })}>
      <div className="container container-fluid">
        {links}
        {(logo || copyright) && (
          <div className="footer__bottom text--center">
            {logo && <div className="margin-bottom--sm">{logo}</div>}
            <div>
              Built with all the love in the world by <a href="https://twitter.com/carllerche" target="_blank" rel="noopener">@carllerche</a>
              <br />
              with the help of our <a href="https://github.com/tokio-rs/tokio/graphs/contributors" target="_blank" rel="noopener">our contributors</a>
            </div>
            {copyright}
          </div>
        )}
      </div>
    </footer>
  );
}
