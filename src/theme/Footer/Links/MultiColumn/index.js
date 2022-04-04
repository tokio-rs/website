/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';
import LinkItem from '@theme/Footer/LinkItem';

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

export default function FooterLinksMultiColumn({ columns }) {
  console.log(columns);
  return (
    <div className="row footer__links">
      <div className="column is-hidden-mobile">{
        columns.slice(0, 3).map((column, i) => (
          <Column key={i} column={column} />
        ))
      }
      </div>
      <div className="column">
        <div className="row">{
          columns.slice(3, 6).map((column, i) => (
            <Column key={i} column={column} />
          ))
        }
        </div>
        <div className="row">{
          columns.slice(6, 9).map((column, i) => (
            <Column key={i} column={column} />
          ))
        }</div>
      </div>
      {
        columns.slice(9, columns.length).map((column, i) => (
          <Column key={i} column={column} />
        ))
      }
    </div>
  );
}
