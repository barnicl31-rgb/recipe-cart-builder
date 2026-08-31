function assessAddressCatalogue(search, goToItems) {
  if (search.choices.length) {
    return {
      code: "search_working",
      message: "Swiggy returned live milk products for this saved address."
    };
  }

  if (goToItems.choices.length) {
    return {
      code: "search_empty_go_to_items_present",
      message: "Swiggy returned available go-to items for this saved address, but its milk search returned no products."
    };
  }

  if (search.unavailableCount > 0 || goToItems.unavailableCount > 0) {
    return {
      code: "catalogue_unavailable",
      message: "Swiggy resolved product records, but none are currently available for this saved address."
    };
  }

  if (search.error || goToItems.error) {
    return {
      code: "tool_error",
      message: search.error || goToItems.error
    };
  }

  return {
    code: "search_and_go_to_empty",
    message: "Swiggy returned neither milk search results nor go-to items for this saved address ID. This does not prove the address is invalid, but the visible street text is not being used as the search location."
  };
}

module.exports = { assessAddressCatalogue };
