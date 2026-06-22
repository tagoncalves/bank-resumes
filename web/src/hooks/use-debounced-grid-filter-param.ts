"use client";

import { useEffect, useState } from "react";

type UseDebouncedGridFilterParamOptions = {
  paramName: string;
  paramValue: string;
  debounceMs?: number;
  onApply?: (value: string) => void;
};

export function replaceGridFilterUrlParam(paramName: string, value: string) {
  const sp = new URLSearchParams(window.location.search);
  if (value) sp.set(paramName, value);
  else sp.delete(paramName);
  const query = sp.toString();
  window.history.replaceState(
    window.history.state,
    "",
    query ? `${window.location.pathname}?${query}` : window.location.pathname,
  );
}

export function useDebouncedGridFilterParam({
  paramName,
  paramValue,
  debounceMs = 350,
  onApply,
}: UseDebouncedGridFilterParamOptions) {
  const [inputValue, setInputValue] = useState(paramValue);
  const [appliedValue, setAppliedValue] = useState(paramValue);

  useEffect(() => {
    setInputValue(paramValue);
    setAppliedValue(paramValue);
  }, [paramValue]);

  useEffect(() => {
    if (inputValue === appliedValue) return;

    const id = window.setTimeout(() => {
      setAppliedValue(inputValue);
      onApply?.(inputValue);
      replaceGridFilterUrlParam(paramName, inputValue);
    }, debounceMs);

    return () => window.clearTimeout(id);
  }, [appliedValue, debounceMs, inputValue, onApply, paramName]);

  function applyValue(value: string) {
    setInputValue(value);
    setAppliedValue(value);
    onApply?.(value);
    replaceGridFilterUrlParam(paramName, value);
  }

  return {
    inputValue,
    setInputValue,
    appliedValue,
    applyValue,
  };
}
