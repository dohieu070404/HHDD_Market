export const PRODUCTS = [
  {
    id: "p1",
    name: "Tai nghe Bluetooth Pro X",
    price: 1290000,
    oldPrice: 1590000,
    rating: 4.6,
    sold: 1240,
    tag: "Bán chạy",
  },
  {
    id: "p2",
    name: "Bàn phím Cơ TKL Dark",
    price: 890000,
    oldPrice: 990000,
    rating: 4.5,
    sold: 860,
    tag: "Gaming",
  },
  {
    id: "p3",
    name: "Sạc nhanh GaN 65W",
    price: 490000,
    oldPrice: 590000,
    rating: 4.7,
    sold: 2100,
    tag: "Tiện ích",
  },
  {
    id: "p4",
    name: "Chuột Wireless Silent",
    price: 320000,
    oldPrice: 390000,
    rating: 4.4,
    sold: 1460,
    tag: "Văn phòng",
  },
  {
    id: "p5",
    name: "Laptop Ultrabook 14”",
    price: 18990000,
    oldPrice: 20990000,
    rating: 4.6,
    sold: 320,
    tag: "Giảm giá",
  },
  {
    id: "p6",
    name: "Loa Mini Bass Boost",
    price: 690000,
    oldPrice: 790000,
    rating: 4.3,
    sold: 980,
    tag: "Âm thanh",
  },
];

export function getProductById(id) {
  return PRODUCTS.find((p) => p.id === id);
}
