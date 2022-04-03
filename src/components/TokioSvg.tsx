import React from 'react';
import { useColorMode } from '@docusaurus/theme-common'

export default function TokioSVG({ className }) {
  const { colorMode } = useColorMode();
  const isDark = colorMode == 'dark';

  return (
    <svg className={className} viewBox="0 0 120 108" version="1.1" xmlns="http://www.w3.org/2000/svg">
      <g id="Page-1" stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
        <defs></defs>
        <g id="01" transform="translate(-900.000000, -275.000000)" fill={isDark ? "white" : "black"}>
          <g id="Group-Copy-2" transform="translate(900.000000, 275.000000)">
            <g id="Group">
              <g id="Mark-Copy">
                <polygon id="Line-Copy-3" transform="translate(37.000000, 67.000000) rotate(-300.000000) translate(-37.000000, -67.000000) " points="35 74.0516078 35 76 39 76 39 74.0516078 39 59.9483922 39 58 35 58 35 59.9483922"></polygon>
                <polygon id="Line" transform="translate(83.000000, 67.000000) rotate(-60.000000) translate(-83.000000, -67.000000) " points="81 74.0516078 81 76 85 76 85 74.0516078 85 59.9483922 85 58 81 58 81 59.9483922"></polygon>
                <path d="M80,54 C80,42.954305 71.045695,34 60,34 C48.954305,34 40,42.954305 40,54 C40,65.045695 48.954305,74 60,74 C71.045695,74 80,65.045695 80,54 Z M44.2328042,54 C44.2328042,45.2920182 51.2920182,38.2328042 60,38.2328042 C68.7079818,38.2328042 75.7671958,45.2920182 75.7671958,54 C75.7671958,62.7079818 68.7079818,69.7671958 60,69.7671958 C51.2920182,69.7671958 44.2328042,62.7079818 44.2328042,54 Z" id="Oval-Copy-2"></path>
                <circle id="Oval-Copy-6" cx="24" cy="75" r="3"></circle>
                <circle id="Oval-Copy-12" cx="60" cy="96" r="3"></circle>
                <circle id="Oval-Copy-13" cx="60" cy="12" r="3"></circle>
                <circle id="Oval-Copy-14" cx="96" cy="33" r="3"></circle>
                <circle id="Oval-Copy-16" cx="24" cy="33" r="3"></circle>
                <circle id="Oval-Copy-15" cx="96" cy="75" r="3"></circle>
                <ellipse id="Oval-Copy-6" cx="60" cy="54" rx="3" ry="3"></ellipse>
                <polygon id="Line" points="2 52 -4.42312853e-13 52 -4.54747351e-13 56 2 56 40 56 42 56 42 52 40 52"></polygon>
                <polygon id="Line" points="80 52 78 52 78 56 80 56 118 56 120 56 120 52 118 52"></polygon>
                <polygon id="Line-Copy-4" points="72.8299167 70.3885725 71.8231708 68.660434 68.3668937 70.6739258 69.3736396 72.4020643 88.5018116 105.236696 89.5085575 106.964834 92.9648345 104.951343 91.9580886 103.223204"></polygon>
                <polygon id="Line-Copy-4" points="32.5813684 2.14002423 31.5746225 0.411885722 28.1183455 2.42537751 29.1250914 4.15351602 48.2532633 36.9881477 49.2600092 38.7162862 52.7162862 36.7027944 51.7095403 34.9746559"></polygon>
                <polygon id="Line-Copy-7" points="90.7095403 4.15351602 91.7162862 2.42537751 88.2600092 0.411885722 87.2532633 2.14002423 68.1250914 34.9746559 67.1183455 36.7027944 70.5746225 38.7162862 71.5813684 36.9881477"></polygon>
                <polygon id="Line-Copy-7" points="50.8265046 72.5969413 51.8332505 70.8688028 48.3769735 68.855311 47.3702276 70.5834495 28.2420556 103.418081 27.2353097 105.14622 30.6915868 107.159712 31.6983326 105.431573"></polygon>
                <polygon id="Line" points="58 87.0167635 58 89 62 89 62 87.0167635 62 72.9832365 62 71 58 71 58 72.9832365"></polygon>
                <polygon id="Line" points="58 35.0516078 58 37 62 37 62 35.0516078 62 20.9483922 62 19 58 19 58 20.9483922"></polygon>
                <polygon id="Line-Copy-2" transform="translate(37.000000, 41.000000) rotate(-60.000000) translate(-37.000000, -41.000000) " points="35 48.0516078 35 50 39 50 39 48.0516078 39 33.9483922 39 32 35 32 35 33.9483922"></polygon>
                <polygon id="Line-Copy" transform="translate(83.000000, 41.000000) rotate(-300.000000) translate(-83.000000, -41.000000) " points="81 48.0516078 81 50 85 50 85 48.0516078 85 33.9483922 85 32 81 32 81 33.9483922"></polygon>
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  )
}
