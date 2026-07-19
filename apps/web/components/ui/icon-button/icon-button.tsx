"use client";

import {
  Button,
  type ButtonActionProps,
  type ButtonLinkProps,
} from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import {
  type ForwardedRef,
  forwardRef,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
} from "react";

export type IconButtonAppearance = "ghost" | "surface" | "solid" | "overlay";
export type IconButtonTone = "neutral" | "notice" | "critical";
export type IconButtonSize = "compact" | "control";

interface IconButtonOwnProps {
  /** Required accessible name. The same copy is used by the default tooltip. */
  label: string;
  icon: ReactNode;
  appearance?: IconButtonAppearance;
  tone?: IconButtonTone;
  /** Compact is reserved for dense pointer-first toolbars. */
  size?: IconButtonSize;
  /** Set false only when an adjacent visible label already explains the action. */
  tooltip?: boolean | string;
  tooltipSide?: "top" | "right" | "bottom" | "left";
  tooltipClassName?: string;
}

export type IconButtonActionProps = IconButtonOwnProps &
  Omit<
    ButtonActionProps,
    "aria-label" | "children" | "controlSize" | "variant"
  >;

export type IconButtonLinkProps = IconButtonOwnProps &
  Omit<
    ButtonLinkProps,
    "aria-label" | "children" | "controlSize" | "variant"
  >;

export type IconButtonProps = IconButtonActionProps | IconButtonLinkProps;

type IconButtonComponentProps =
  | (IconButtonActionProps & RefAttributes<HTMLButtonElement>)
  | (IconButtonLinkProps & RefAttributes<HTMLAnchorElement>);

interface IconButtonComponent {
  (props: IconButtonComponentProps): ReactElement;
  displayName?: string;
}

const appearanceVariant = {
  ghost: "ghost",
  surface: "secondary",
  solid: "primary",
  overlay: "ghost",
} as const;

/** The single icon-only action primitive. It owns target size, glyph scale,
 * accessible naming, busy behavior, tone, and tooltip presentation. */
const IconButtonRoot = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  IconButtonProps
>(
  function IconButton(
    {
      appearance = "surface",
      tone = "neutral",
      size = "control",
      label,
      icon,
      tooltip = false,
      tooltipSide = "top",
      tooltipClassName,
      className,
      ...buttonProps
    },
    ref
  ) {
    const visualClassName = cn(
      appearance === "ghost" && "hover:bg-surface-2",
      appearance === "overlay" &&
        "bg-scrim text-foreground hover:bg-scrim active:bg-scrim",
      tone === "notice" && "text-notice",
      tone === "critical" &&
        "bg-error text-on-primary hover:bg-error active:bg-error",
      size === "compact" && "size-search-control min-h-search-control",
      className
    );

    const button = buttonProps.href !== undefined ? (
      <Button
        {...buttonProps}
        ref={ref as ForwardedRef<HTMLAnchorElement>}
        variant={appearanceVariant[appearance]}
        controlSize="square"
        aria-label={label}
        className={visualClassName}
      >
        {icon}
      </Button>
    ) : (
      <Button
        {...buttonProps}
        ref={ref as ForwardedRef<HTMLButtonElement>}
        variant={appearanceVariant[appearance]}
        controlSize="square"
        aria-label={label}
        className={visualClassName}
      >
        {icon}
      </Button>
    );

    if (tooltip === false) return button;
    const tooltipLabel = typeof tooltip === "string" ? tooltip : label;

    return (
      <Tooltip
        label={tooltipLabel}
        side={tooltipSide}
        positionerClassName={cn("z-50", tooltipClassName)}
      >
        {button}
      </Tooltip>
    );
  }
);

export const IconButton = IconButtonRoot as IconButtonComponent;
IconButton.displayName = "IconButton";
