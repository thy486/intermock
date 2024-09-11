export interface Address {
    /**
     * @examples ["Borders"]
     */
    country: string;
    /**
     * @mockType {address.city}
     */
    city: string;
    /**
     * @mockType {address.street}
     */
    street: string;
}