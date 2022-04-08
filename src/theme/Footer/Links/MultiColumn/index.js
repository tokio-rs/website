/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';
import LinkItem from '@theme/Footer/LinkItem';
import { chunkify } from '../../../../utils';
import { GetHelp } from '../../../DocItemFooter/index'
import styles from './styles.module.css'
import clsx from 'clsx';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

function ColumnLinkItem({ item }) {
  return item.html ? (
    <li
      className="footer__item" // Developer provided the HTML, so assume it's safe.
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: item.html,
      }}
    />
  ) : (
    <li key={item.href || item.to} className="footer__item">
      <LinkItem item={item} />
    </li>
  );
}

function Column({ column }) {
  return (
    <div className="column footer__col">
      <div className="footer__title">{column.title}</div>
      <ul className="footer__items">
        {column.items.map((item, i) => (
          <ColumnLinkItem key={i} item={item} />
        ))}
      </ul>
    </div>
  );
}

function TwitterSVG() {
  return (
    <svg className={styles.twitterCard} viewBox="0 0 1792 1792" xmlns="http://www.w3.org/2000/svg"><path class="tk-svg-path" d="M1684 408q-67 98-162 167 1 14 1 42 0 130-38 259.5t-115.5 248.5-184.5 210.5-258 146-323 54.5q-271 0-496-145 35 4 78 4 225 0 401-138-105-2-188-64.5t-114-159.5q33 5 61 5 43 0 85-11-112-23-185.5-111.5t-73.5-205.5v-4q68 38 146 41-66-44-105-115t-39-154q0-88 44-163 121 149 294.5 238.5t371.5 99.5q-8-38-8-74 0-134 94.5-228.5t228.5-94.5q140 0 236 102 109-21 205-78-37 115-142 178 93-10 186-50z" fill='inherit'></path></svg>
  )
}


function Help() {
  const { siteConfig: { customFields } } = useDocusaurusContext();
  return (
    <div className={clsx("column is-hidden-mobile", styles.getHelpContainer)}>
      <GetHelp fill={"white"} className={styles.socialIconsRow} />
      <div className={clsx("is-flex", styles.iconContainer)}>
        <div>Stay up to date: &nbsp;</div>
        <a href={customFields.handles.twitter} target="_blank" rel="noopener noreferrer" aria-label="Twitter Handle">
          <TwitterSVG />
        </a>
      </div>
    </div>
  )
}

export default function FooterLinksMultiColumn({ columns }) {
  return (
    <div className={clsx("row footer__links", styles.footerContainer)}>
      <Help />
      <div className={clsx("column", styles.libsContainer)}>
        {chunkify(columns, 3).map(threeCols => (
          <div className='row'>
            {threeCols.map((column, i) => (
              <Column key={i} column={column} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
