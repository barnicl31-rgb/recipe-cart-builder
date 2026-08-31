function assessAddressCatalogue(search, addressCatalogue) {
  if (search.choices.length) {
    return {
      code: "search_working",
      message: "Swiggy returned live milk products for this saved address."
    };
  }

  if (addressCatalogue.choices.length) {
    return {
      code: "search_empty_catalogue_working",
      message: "This saved address resolves to an Instamart catalogue, but Swiggy's product search returned no milk products."
    };
  }

  if (search.unavailableCount > 0 || addressCatalogue.unavailableCount > 0) {
    return {
      code: "catalogue_unavailable",
      message: "Swiggy resolved product records, but none are currently available for this saved address."
    };
  }

  if (search.error || addressCatalogue.error) {
    return {
      code: "tool_error",
      message: search.error || addressCatalogue.error
    };
  }

  return {
    code: "address_catalogue_empty",
    message: "Swiggy returned an empty product search and an empty address catalogue for this saved address ID."
  };
}

module.exports = { assessAddressCatalogue };
