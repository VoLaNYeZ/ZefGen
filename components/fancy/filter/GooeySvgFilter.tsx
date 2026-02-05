import React from 'react';

type GooeySvgFilterProps = {
    id?: string;
    strength?: number;
};

export default function GooeySvgFilter({ id = 'gooey-filter', strength = 10 }: GooeySvgFilterProps) {
    return (
        <svg className="hidden absolute" aria-hidden="true" focusable="false">
            <defs>
                <filter id={id}>
                    <feGaussianBlur in="SourceGraphic" stdDeviation={strength} result="blur-sm" />
                    <feColorMatrix
                        in="blur-sm"
                        type="matrix"
                        values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
                        result="goo"
                    />
                    <feComposite in="SourceGraphic" in2="goo" operator="atop" />
                </filter>
            </defs>
        </svg>
    );
}
